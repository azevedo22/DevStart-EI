# DevStart EI

Plataforma web para recém-formados em Engenharia Informática que estão a procurar o primeiro emprego.
Ajuda a responder a três perguntas:

1. **O que me falta para a vaga que procuro?** Diagnóstico de _skill gap_ face a uma stack júnior.
2. **Como provo o que sei sem experiência comercial?** Cada competência liga-se a projetos (_Proof of Work_).
3. **Em que ponto estão as minhas candidaturas?** Quadro Kanban do envio do CV até à proposta.

> Estado: os três módulos funcionam de ponta a ponta (autenticação, perfil com projetos, diagnóstico de
> skill gap e quadro de candidaturas). Próximos passos: Dockerfiles por serviço e deploy.

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
                        ╲        │        ╱
                    libs/shared-types (contratos + lógica de gap)
```

| Projeto                | Responsabilidade                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/web`             | SPA em Angular 22 (Standalone Components, Signals, Reactive Forms, RxJS) + Bootstrap 5 / ng-bootstrap |
| `apps/api-gateway`     | Ponto de entrada único. Valida o JWT e encaminha `/api/v1/<recurso>` para o serviço dono do recurso   |
| `apps/auth-service`    | Registo, login, JWT e refresh tokens com rotação (PostgreSQL + TypeORM + migrações)                   |
| `apps/profile-service` | Perfil, competências declaradas, projetos, stacks alvo e cálculo do skill gap (PostgreSQL)            |
| `apps/tracker-service` | Candidaturas, Kanban com histórico de estados, entrevistas e estatísticas (PostgreSQL)                |
| `libs/shared-types`    | Contratos partilhados e lógica de domínio pura: `calculateSkillGap`, `analyzeJobPosting`              |
| `libs/backend-common`  | Código comum dos serviços NestJS: identidade via gateway, transformações, validação de config         |

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

## Como correr

Requisitos: Node.js 22+ e Docker (para o PostgreSQL).

```bash
npm install
cp .env.example .env
docker compose up -d db   # PostgreSQL com as bases de dados de cada serviço
npm start                 # web + gateway + 3 serviços
```

As migrações correm automaticamente quando o `auth-service` arranca.

- Aplicação: http://localhost:4200
- API Gateway: http://localhost:3000/api/v1

Outros comandos:

```bash
npm run start:backend  # só os serviços
npm test               # testes de todos os projetos
TEST_DATABASE_URL=postgres://devstart:devstart@localhost:5432/devstart_test npm test
                       # inclui os testes e2e contra PostgreSQL (ignorados sem esta variável)
npm run build          # build de todos os projetos
npm run graph          # grafo de dependências do monorepo
```

As variáveis de ambiente estão documentadas em `.env.example`.

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
- [ ] Dockerfiles por serviço e `docker compose up` da aplicação inteira
- [x] Perfil: competências declaradas e projetos (Proof of Work)
- [x] Diagnóstico com os dados guardados e ranking das stacks mais próximas
- [x] Kanban de candidaturas com drag & drop, histórico de estados e entrevistas com feedback
- [x] Análise de anúncios e filtro de vagas acessíveis a quem tem 0 anos de experiência
- [ ] Conta de demonstração com dados de exemplo
- [ ] Evento `user.deleted` para limpar dados nos outros serviços

## Autor

Cláudio Azevedo · [LinkedIn](https://www.linkedin.com/in/claudioazevedo1) · [GitHub](https://github.com/azevedo22)
