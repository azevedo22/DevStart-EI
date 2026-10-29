# DevStart EI

Plataforma web para recém-formados em Engenharia Informática que estão a procurar o primeiro emprego.
Ajuda a responder a três perguntas:

1. **O que me falta para a vaga que procuro?** Diagnóstico de _skill gap_ face a uma stack júnior.
2. **Como provo o que sei sem experiência comercial?** Cada competência liga-se a projetos (_Proof of Work_).
3. **Em que ponto estão as minhas candidaturas?** Quadro Kanban do envio do CV até à proposta.

> Estado: os três módulos funcionam de ponta a ponta (autenticação, perfil com projetos, diagnóstico de
> skill gap e quadro de candidaturas), com eventos entre serviços. A aplicação inteira corre em contentores
> com um comando, e está pronta a publicar num servidor com HTTPS ([guia de deploy](docs/deploy.md)).

## Arquitetura

```
                     ┌──────────────────────┐
  Angular (web) ───▶ │  API Gateway :3000   │  /api/v1/*  → encaminha por recurso
                     │  valida o JWT        │
                     └──┬─────────┬───────┬─┘
                        │         │       │
             ┌──────────▼┐ ┌──────▼─────┐ ┌▼──────────────────┐
             │ auth      │ │ profile    │ │ tracker           │
             │ :3001     │ │ :3002      │ │ :3003             │
             └─────┬─────┘ └─────┬──────┘ └─────────┬─────────┘
                   │             │                  │
               PostgreSQL    PostgreSQL         PostgreSQL     (uma base de dados por serviço)
                   │             ▲                  ▲
                   └──outbox──▶ Redis Streams ──────┘          (eventos: user.deleted)
                        ╲        │        ╱
                    libs/shared-types (contratos + lógica de gap)
```

| Projeto                | Responsabilidade                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `apps/web`             | SPA em Angular 22 (Standalone Components, Signals, Reactive Forms, RxJS) + Bootstrap 5 / ng-bootstrap   |
| `apps/api-gateway`     | Ponto de entrada único. Valida o JWT e encaminha `/api/v1/<recurso>` para o serviço dono do recurso     |
| `apps/auth-service`    | Registo, login, JWT e refresh tokens com rotação (PostgreSQL + TypeORM + migrações)                     |
| `apps/profile-service` | Perfil, competências declaradas, projetos, stacks alvo e cálculo do skill gap (PostgreSQL)              |
| `apps/tracker-service` | Candidaturas, Kanban com histórico de estados, entrevistas e estatísticas (PostgreSQL)                  |
| `libs/shared-types`    | Contratos partilhados e lógica de domínio pura: `calculateSkillGap`, `analyzeJobPosting`                |
| `libs/backend-common`  | Código comum dos serviços NestJS: identidade via gateway, barramento de eventos (Redis Streams), config |

### Decisões de arquitetura

- **Monorepo Nx.** Frontend e backend partilham os mesmos contratos TypeScript: se um tipo muda, o compilador
  aponta todos os sítios afetados. O `nx affected` faz com que o CI só teste o que foi alterado.
- **Competências declaradas, não disciplinas.** O utilizador declara o que domina e o nível. As disciplinas
  variam entre cursos e dizem pouco ao mercado; as competências são o vocabulário comum de perfis, stacks e vagas.
- **Projetos como prova.** Os projetos não mudam a percentagem de compatibilidade, só organizam o resultado:
  _pronto a mostrar_, _sabes mas falta um projeto_, _abaixo do nível_ e _falta aprender_.
- **Lógica de domínio partilhada.** `calculateSkillGap` é uma função pura usada no backend e no browser,
  por isso o diagnóstico atualiza ao escrever, sem pedidos à API.
- **Projetos como entidade própria.** As competências de cada projeto ficam numa tabela de ligação
  (`project_competencies`), indexada por competência, em vez de um array. As práticas de indústria, que são
  uma lista fechada de cinco valores, ficam num array.
- **Isolamento entre utilizadores.** Todas as consultas filtram por dono. Um projeto de outra pessoa
  responde 404, não 403, para não revelar que o id existe. Testado com dois utilizadores nos e2e.
- **Análise de vagas explicável.** `analyzeJobPosting` lê o texto de um anúncio e extrai competências, anos
  de experiência e senioridade, e classifica a vaga como _acessível_, _vale a pena tentar_ ou _pouco
  realista_ para quem tem zero anos. Deteta vagas "júnior" que pedem 3+ anos. É uma heurística por
  palavras-chave, não IA: previsível, testável e cada conclusão vem com o motivo. Termos ambíguos ("REST",
  "SOLID", "Spring") só contam escritos como termo técnico, para "the rest of the team" não ser uma
  competência. Os testes correm contra o catálogo real.
- **Kanban com posições consistentes.** Cada coluna mantém posições contínuas (0, 1, 2…). Mover, criar e
  apagar acontecem numa transação com um bloqueio por utilizador (`pg_advisory_xact_lock`). Um teste e2e
  faz 20 movimentos em simultâneo e verifica que nenhuma posição fica repetida nem com buracos. No
  frontend, o movimento é otimista e volta atrás se o servidor recusar.
- **A acessibilidade é sempre calculada no servidor**, a partir dos anos e da senioridade, com a mesma
  função que o formulário usa para a pré-visualização. O cliente não a pode definir.
- **Catálogo com ids estáveis.** 47 competências em 8 categorias, cada uma com `aliases` para reconhecer
  termos em texto livre (ex.: "Jest" → `unit-testing`). Os seeds têm testes que impedem ids duplicados e
  referências partidas.

### Autenticação

```
 browser                    gateway                    auth-service
   │ POST /auth/login          │                            │
   │──────────────────────────▶│───────────────────────────▶│ bcrypt.compare
   │◀── access token (JSON) ───│◀── + cookie httpOnly ──────│ guarda hash do refresh
   │    (fica em memória)      │                            │
   │                           │                            │
   │ GET /profile + Bearer ───▶│ valida JWT                 │
   │                           │ x-user-id: <id> ──────────▶ profile-service
   │                           │                            │
   │ 401 (token expirou)       │                            │
   │ POST /auth/refresh ──────▶│───────────────────────────▶│ roda o token:
   │◀── novo access token ─────│◀── novo cookie ────────────│ revoga o antigo
```

- **Access token em memória, refresh token em cookie `httpOnly`.** Um script injetado não consegue ler
  nenhum dos dois. O cookie é `SameSite=Strict` e só viaja para `/api/v1/auth`.
- **Rotação com deteção de roubo.** Cada refresh revoga o token usado. Se um token já usado voltar a
  aparecer, a sessão inteira é revogada. No frontend, pedidos em paralelo partilham um único refresh,
  para o próprio utilizador não ser confundido com um atacante.
- **Gateway como fronteira.** Valida o JWT antes de encaminhar e passa a identidade em `x-user-id`. Apaga
  sempre esse cabeçalho do pedido original, por isso um cliente não o pode forjar. Uma rota só é pública
  se estiver explicitamente na lista: esquecer uma entrada fecha, nunca abre.
- **Proteção de credenciais.** Passwords com bcrypt, resposta igual para email inexistente e password
  errada (também no tempo de resposta), e limite de 10 tentativas por minuto no login e registo.
- **Regras partilhadas.** As regras de password vêm de `libs/shared-types` e são validadas no formulário
  e no servidor com o mesmo critério.

### Eventos entre serviços

Quando alguém apaga a conta, os dados estão em três bases de dados diferentes. O Auth Service não chama
os outros serviços: publica um evento `user.deleted` e cada serviço trata do que é seu.

```
 auth-service                         Redis Streams                profile / tracker
 ┌───────────────────────────┐        ┌──────────────┐           ┌──────────────────────┐
 │ BEGIN                     │        │              │  grupo    │ apaga os dados desse │
 │  DELETE users             │ relay  │ devstart:    │ ────────▶ │ utilizador (idempo-  │
 │  INSERT outbox_events     │ ─────▶ │ events       │  XACK     │ tente) e confirma    │
 │ COMMIT                    │        │              │ ◀──────── │                      │
 └───────────────────────────┘        └──────────────┘           └──────────────────────┘
```

- **Transactional outbox.** O evento é gravado na mesma transação que apaga o utilizador. Um _relay_
  publica-o no Redis e repete enquanto não conseguir. Se o Redis estiver em baixo no momento, nada se perde.
- **Redis Streams com consumer groups, não pub/sub.** Cada serviço tem o seu grupo e confirma cada evento
  (`XACK`) só depois de o tratar. Um serviço que estava em baixo recebe os eventos ao voltar. Testado:
  com o tracker desligado, a conta foi apagada e as candidaturas desapareceram quando ele arrancou.
- **Entrega pelo menos uma vez.** Os handlers são idempotentes (apagar duas vezes = apagar uma).
  Um evento que falha 5 vezes vai para uma _dead-letter_ em vez de bloquear os seguintes.
- **Tokens revogados.** Os access tokens não têm estado e valeriam até expirar. Ao apagar a conta, o Auth
  Service marca o utilizador como revogado no Redis durante 15 minutos (a validade do token) e o gateway
  recusa esses tokens. Sem isto, um token antigo podia voltar a criar dados para uma conta apagada.

### Redis: o que guarda e o que acontece se falhar

| Uso                                                        | Se o Redis falhar                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Eventos entre serviços                                     | Ficam no outbox e são publicados quando o Redis voltar                          |
| Contadores do rate limiting (partilhados entre instâncias) | Deixa passar e regista (_fail-open_): uma falha do Redis não bloqueia os logins |
| Revogação de tokens                                        | Deixa passar: os tokens expiram sozinhos em 15 minutos                          |

O catálogo de competências e stacks usa cache HTTP (`Cache-Control` + `ETag`): o browser guarda-o
5 minutos e depois revalida; sem alterações, a resposta é um `304` sem corpo.

### Em contentores

```
 browser ──▶ nginx :8080 ──┬── /        → ficheiros estáticos do Angular
                           └── /api/... → api-gateway → auth / profile / tracker
                                                              │
                                                    PostgreSQL + Redis
```

- **Só o nginx tem porta publicada.** Os serviços, o gateway, o PostgreSQL e o Redis ficam na rede interna
  do Docker. O frontend e a API partilham a mesma origem: sem CORS, e o cookie `SameSite=Strict` funciona
  sem exceções.
- **Um Dockerfile multi-stage para as 5 imagens.** Os serviços NestJS constroem-se da mesma forma, e o
  `npm ci` do monorepo fica numa camada partilhada: depois da primeira imagem, as outras constroem-se em
  segundos. Cada imagem final leva só o bundle do serviço e as dependências que ele importa (cerca de
  50 MB em vez das centenas do monorepo), e corre como utilizador sem privilégios.
- **Healthchecks e ordem de arranque.** Cada serviço só arranca depois de o PostgreSQL e o Redis estarem
  saudáveis, o gateway depois dos serviços, e o nginx depois do gateway.
- **Cabeçalhos de segurança no nginx**, incluindo uma Content Security Policy que só permite scripts da
  própria origem.
- **O IP real do cliente atravessa os proxies.** O rate limiting conta tentativas por IP. Atrás do nginx e
  do gateway, o auth-service lê o IP de `X-Forwarded-For` saltando o número certo de proxies
  (`TRUST_PROXY_HOPS`). Com o valor errado, todos os pedidos pareceriam vir do nginx e 10 logins falhados
  de uma pessoa bloqueariam toda a gente. Um `X-Forwarded-For` forjado pelo cliente não muda nada.
- **Smoke test na CI.** Um job constrói as imagens, arranca a stack inteira e percorre-a através do nginx
  (`tools/smoke-test.sh`): frontend, cabeçalhos, registo, os três serviços, eliminação da conta e revogação
  do token.

## Como correr

Requisitos: Node.js 22+ e Docker (para o PostgreSQL).

```bash
npm install
cp .env.example .env
docker compose up -d      # PostgreSQL (uma base por serviço) e Redis
npm start                 # web + gateway + 3 serviços
```

As migrações correm automaticamente quando cada serviço arranca.

- Aplicação: http://localhost:4200
- API Gateway: http://localhost:3000/api/v1

Outros comandos:

```bash
npm run start:backend  # só os serviços
npm test               # testes de todos os projetos
TEST_DATABASE_URL=postgres://devstart:devstart@localhost:5432/devstart_test \
TEST_REDIS_URL=redis://localhost:6379 npm test
                       # inclui os testes e2e contra PostgreSQL e Redis (ignorados sem estas variáveis)
npm run build          # build de todos os projetos
npm run graph          # grafo de dependências do monorepo
```

As variáveis de ambiente estão documentadas em `.env.example`.

### Correr tudo com Docker

Para ver a aplicação como em produção, sem instalar Node.js:

```bash
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 48)" >> .env
docker compose --profile app up -d --build   # primeira vez: alguns minutos
tools/smoke-test.sh                          # opcional: verifica a stack de ponta a ponta
```

- Aplicação: http://localhost:8080

Se já tinhas corrido o modo de desenvolvimento, o volume do PostgreSQL é reaproveitado (com as migrações
aplicadas por cima). Para começar do zero: `docker compose --profile app down -v`.

Para publicar num servidor com domínio e HTTPS, ver [docs/deploy.md](docs/deploy.md).

## API (implementada até agora)

| Método               | Endpoint                            | Descrição                                             |
| -------------------- | ----------------------------------- | ----------------------------------------------------- |
| `POST`               | `/api/v1/auth/register`             | Cria conta, devolve access token e define o cookie    |
| `POST`               | `/api/v1/auth/login`                | Inicia sessão                                         |
| `POST`               | `/api/v1/auth/refresh`              | Novo access token a partir do cookie (com rotação)    |
| `POST`               | `/api/v1/auth/logout`               | Revoga a sessão e limpa o cookie                      |
| `GET`                | `/api/v1/auth/me`                   | Utilizador autenticado 🔒                             |
| `GET`                | `/api/v1/profile`                   | Perfil com as competências declaradas 🔒              |
| `PUT`                | `/api/v1/profile`                   | Atualiza título, instituição, ano e apresentação 🔒   |
| `PUT`                | `/api/v1/profile/competencies/:id`  | Declara uma competência ou muda o nível 🔒            |
| `DELETE`             | `/api/v1/profile/competencies/:id`  | Remove uma competência do perfil 🔒                   |
| `GET`                | `/api/v1/projects`                  | Projetos do utilizador 🔒                             |
| `POST`               | `/api/v1/projects`                  | Cria um projeto 🔒                                    |
| `GET`/`PUT`/`DELETE` | `/api/v1/projects/:id`              | Lê, substitui ou apaga um projeto 🔒                  |
| `GET`                | `/api/v1/skill-gap?stackId=`        | Gap calculado com o perfil guardado 🔒                |
| `GET`                | `/api/v1/skill-gap/overview`        | Compatibilidade com todas as stacks, ordenada 🔒      |
| `GET`                | `/api/v1/competencies?category=&q=` | Catálogo de competências (pesquisa em nome e aliases) |
| `GET`                | `/api/v1/competencies/:id`          | Detalhe de uma competência                            |
| `GET`                | `/api/v1/stacks`                    | Stacks alvo                                           |
| `GET`                | `/api/v1/stacks/:id`                | Detalhe de uma stack                                  |
| `POST`               | `/api/v1/skill-gap/preview`         | Calcula o gap sem perfil guardado                     |
| `GET`                | `/api/health`                       | Estado de cada serviço (em cada porta)                |

🔒 exige `Authorization: Bearer <token>`. Tudo o que não está nesta tabela também é protegido por omissão.

## Estrutura do frontend

```
apps/web/src/app/
├── core/        # singletons: sessão, catálogo, estado do perfil, interceptors, guards, layout
├── shared/      # componentes reutilizáveis sem lógica de negócio
└── features/    # uma pasta por domínio, carregada sob demanda
    ├── home/
    ├── auth/          # login e registo
    ├── skill-gap/     # Módulo 1: diagnóstico (com o perfil guardado ou em simulação)
    ├── profile/       # Módulo 2: perfil, competências e projetos
    └── applications/  # Módulo 3: Kanban com drag & drop (Angular CDK), análise de vagas e entrevistas
```

## Roadmap

- [x] Monorepo, gateway, serviços e biblioteca de tipos partilhados
- [x] Catálogo de competências e stacks alvo
- [x] Diagnóstico de skill gap (API + interface)
- [x] CI com GitHub Actions (com PostgreSQL para os testes e2e)
- [x] Auth Service: registo, login, JWT, refresh com rotação e validação no gateway
- [x] PostgreSQL com migrações e Docker Compose
- [x] Imagens Docker, `docker compose` da aplicação inteira e smoke test na CI
- [ ] Publicação online (configuração com HTTPS pronta: [docs/deploy.md](docs/deploy.md))
- [x] Perfil: competências declaradas e projetos (Proof of Work)
- [x] Diagnóstico com os dados guardados e ranking das stacks mais próximas
- [x] Kanban de candidaturas com drag & drop, histórico de estados e entrevistas com feedback
- [x] Análise de anúncios e filtro de vagas acessíveis a quem tem 0 anos de experiência
- [x] Eventos entre serviços (Redis Streams + outbox) e eliminação de conta em todos os serviços
- [x] Rate limiting partilhado em Redis, revogação de tokens e cache HTTP do catálogo
- [ ] Conta de demonstração com dados de exemplo

## Autor

Cláudio Azevedo · [LinkedIn](https://www.linkedin.com/in/claudioazevedo1) · [GitHub](https://github.com/azevedo22)
