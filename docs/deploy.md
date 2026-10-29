# Pôr o DevStart EI online

Guia para publicar a aplicação num servidor próprio (VPS) com HTTPS, usando os
mesmos contentores que correm localmente com `docker compose --profile app up`.

## Porquê um VPS

A aplicação são 7 contentores: nginx, gateway, 3 serviços, PostgreSQL e Redis.
Numa plataforma que cobra ou limita por serviço, isto multiplica-se depressa.
Num VPS pequeno corre tudo com um só comando, igual ao ambiente local, e o
que se aprende (Docker, DNS, HTTPS, backups) é útil em qualquer empresa.

**Requisitos:** um servidor Linux com Docker (Compose v2.24 ou mais recente),
pelo menos **2 GB de RAM** (o build do Angular é o passo mais pesado), e um
domínio ou subdomínio.

## Arquitetura em produção

```
Internet ──443──▶ Caddy (HTTPS, Let's Encrypt)
                    │
                    ▼
                  nginx (frontend estático + /api)
                    │
                    ▼
                  api-gateway ──▶ auth / profile / tracker ──▶ PostgreSQL
                                          │
                                          └──────────────────▶ Redis
```

Só o Caddy publica portas (80 e 443). O PostgreSQL, o Redis, os serviços e o
próprio nginx ficam na rede interna do Docker.

## 1. DNS

Cria um registo `A` (e `AAAA`, se o servidor tiver IPv6) a apontar o domínio
para o IP do servidor, por exemplo `devstart.teudominio.pt → 203.0.113.10`.

O Caddy só consegue pedir o certificado depois de o DNS propagar. Confirma com
`dig +short devstart.teudominio.pt`.

## 2. Servidor

```bash
# Docker (script oficial)
curl -fsSL https://get.docker.com | sh

# Firewall: só SSH, HTTP e HTTPS
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable

# Com 2 GB de RAM, um swap de 2 GB evita que o build do Angular fique sem memória
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 3. Configuração

```bash
git clone <url-do-repositório> devstart-ei && cd devstart-ei

cat > .env <<EOF
DOMAIN=devstart.teudominio.pt
JWT_ACCESS_SECRET=$(openssl rand -base64 48)
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
EOF
chmod 600 .env
```

`POSTGRES_PASSWORD` só tem efeito na **primeira** vez que a base de dados é
criada. Mudá-la depois exige `ALTER USER` dentro do PostgreSQL.

## 4. Arrancar

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile app up -d --build
```

O primeiro arranque demora alguns minutos (build das imagens). Depois:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile app ps
curl -I https://devstart.teudominio.pt
```

Para não repetir os `-f`, define no `.env` do servidor:

```bash
COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml
COMPOSE_PROFILES=app
```

e a partir daí basta `docker compose up -d --build`, `docker compose ps`, etc.
Os comandos abaixo assumem isso.

## Operação

| Tarefa                    | Comando                                                                      |
| ------------------------- | ---------------------------------------------------------------------------- |
| Atualizar para o `main`   | `git pull && docker compose up -d --build`                                   |
| Ver logs de um serviço    | `docker compose logs -f auth-service`                                        |
| Estado e healthchecks     | `docker compose ps`                                                          |
| Backup das bases de dados | `docker compose exec -T db pg_dumpall -U devstart > backup.sql`              |
| Eventos por consumir      | `docker compose exec redis redis-cli XINFO GROUPS devstart:events`           |
| Eventos na dead-letter    | `docker compose exec redis redis-cli XRANGE devstart:events:dead-letter - +` |

As migrações correm automaticamente quando cada serviço arranca.

Os backups ficam no próprio servidor. Copia-os para fora (outro servidor,
armazenamento de objetos) para sobreviverem a uma falha do disco.

## Problemas comuns

- **O Caddy não obtém certificado.** O DNS ainda não aponta para o servidor, ou
  as portas 80/443 estão fechadas. Vê `docker compose logs caddy`.
- **O build termina com `Killed`.** Faltou memória: confirma o swap (passo 2).
- **Login funciona mas a sessão perde-se ao recarregar.** O cookie de refresh é
  `Secure`: só funciona em HTTPS (ou em `http://localhost`).
- **Todos os utilizadores recebem 429 ao mesmo tempo.** O número de proxies à
  frente do auth-service (`TRUST_PROXY_HOPS`) está errado e todos os pedidos
  parecem vir do mesmo IP. Com o Caddy são 3; sem ele, 2.
