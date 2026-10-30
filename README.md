# DevStart EI

Plataforma web para recém-formados em Engenharia Informática que estão a procurar o primeiro emprego.
Ajuda a responder a três perguntas:

1. **O que me falta para a vaga que procuro?** Diagnóstico de _skill gap_ face a uma stack júnior.
2. **Como provo o que sei sem experiência comercial?** Cada competência liga-se a projetos (_Proof of Work_).
3. **Em que ponto estão as minhas candidaturas?** Quadro Kanban do envio do CV até à proposta.

> Estado: os três módulos funcionam de ponta a ponta (autenticação, perfil com projetos, diagnóstico de
> skill gap e quadro de candidaturas), com eventos entre serviços. A aplicação inteira corre em contentores
> com um comando, e está pronta a publicar num servidor com HTTPS ([guia de deploy](docs/deploy.md)).
>
> **Para experimentar sem criar conta:** botão _Experimentar sem registo_ na página inicial. Cria uma
> conta só tua, já com perfil, projetos e candidaturas de exemplo, que se apaga sozinha ao fim de 24 horas.

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

### Objetivo diário e relatório semanal

**Nos dias úteis**, uma meta pequena de candidaturas: **1 é suficiente, 2 é bom, 3 é muito bom**.
Aparece no topo das Candidaturas e na página inicial, com quanto falta para o próximo patamar, a
sequência de dias úteis seguidos, a semana de segunda a domingo e uma pequena celebração ao subir de
patamar. **Ao fim de semana não há objetivo:** o cartão aponta para o relatório.

A página **Progresso** (`/progress`) é o relatório da semana:

- **Gráfico dia a dia** (segunda a domingo): candidaturas, respostas positivas, rejeições,
  entrevistas e projetos, com os números de cada dia ao passar o rato ou com o teclado.
- **Lista por dia**, em texto: "Terça-feira: 2 candidaturas · 1 resposta positiva", com cada
  evento (empresa, nova fase, 1.ª ou 2.ª entrevista do processo, projeto).
- **Totais face à semana anterior**, **objetivos da semana** (15 candidaturas, objetivo diário nos
  5 dias úteis, pelo menos um projeto novo ou atualizado) e, ao fim de semana ou em semanas
  passadas, notas **para refletir**. Dá para recuar semana a semana.

Como funciona:

- **Respostas** são mudanças de coluna no Kanban, já registadas no histórico: sair de "Candidatado"
  para uma fase de entrevista (ou passar de fase) é uma resposta positiva; "Proposta" e "Rejeitado"
  contam à parte; voltar a "Candidatado" para corrigir um engano não conta.
- **Cada serviço dá a sua parte.** `GET /applications/activity` (tracker) e `GET /projects/activity`
  (profile) devolvem eventos de um intervalo, com o dia calculado no PostgreSQL no **fuso do
  utilizador** (`AT TIME ZONE`): uma resposta às 23h30 conta nesse dia. O browser junta os dois e o
  relatório é uma função pura partilhada e testada (`weeklyReport` em `libs/shared-types`).
- **Projetos:** conta-se o dia em que foram criados e o da última atualização (só a última fica
  guardada).
- **O objetivo diário é instantâneo:** é calculado no browser a partir do quadro, por isso atualiza no
  momento em que se cria uma candidatura, e recomeça sozinho à meia-noite.

### Importar o CV com IA

Uma conta nova começa pelo perfil, com um botão para importar o CV (PDF ou DOCX). Um modelo de
linguagem local ([Ollama](https://ollama.com)) lê o CV e preenche o perfil: título, localização, links,
formação, experiência, línguas, competências e projetos.

- **Dois passos, nada gravado sem confirmação.** `POST /profile/cv/analyze` devolve um rascunho; o
  utilizador escolhe e corrige o que entra, e só `POST /profile/cv/import` grava, numa transação.
  O que já está no perfil vem desmarcado: a importação nunca substitui dados sem o utilizador escolher,
  e importar o mesmo CV duas vezes não duplica nada.
- **O ficheiro não é guardado.** Fica em memória durante o pedido; o formato é verificado pelos
  primeiros bytes, não pela extensão.
- **IA local, com saída estruturada.** O Ollama obriga o modelo a responder segundo um JSON Schema,
  com temperatura 0. Mesmo assim, a resposta é tratada como texto não confiável: datas, anos, links e
  níveis são validados e normalizados (`cv-normalize.ts`), e as tecnologias são mapeadas para o
  catálogo com a mesma deteção por palavras-chave da análise de vagas.
- **Três fornecedores, escolhidos no `.env`.** `LLM_PROVIDER=ollama` (local, gratuito, o CV não sai
  do computador), `groq` ou `xai` (APIs compatíveis com a da OpenAI: mais rápidas e precisas, mas o
  CV é enviado; a revisão avisa o utilizador). Se um modelo não aceitar o esquema estrito, o cliente
  repete em modo JSON simples. No arranque, o serviço confirma a chave e o modelo, e deteta chaves
  trocadas entre fornecedores (Groq e Grok confundem-se muito). O resto do código só conhece a
  interface `StructuredLlm`.
- **Funciona sem IA.** Se o Ollama estiver parado ou o modelo não estiver instalado, a análise
  devolve o que as palavras-chave encontram (competências e links) e diz porquê.

Para usar: com o Ollama, instalar o modelo (`ollama pull qwen2.5:7b`, ou outro definido em
`OLLAMA_MODEL`); com a Groq ou a xAI, pôr `LLM_PROVIDER` e a respetiva chave (`GROQ_API_KEY`, `XAI_API_KEY`) no `.env`.

### Analisar anúncios com IA

Em _Nova candidatura_, o utilizador cola o texto do anúncio e carrega em **Analisar**. A mesma IA que
lê os CVs preenche **empresa, título da vaga, senioridade, anos e tipos de experiência pedidos e
competências**, e ainda a modalidade e a localização quando o anúncio as indica. Nada é gravado até
carregar em guardar.

- **`POST /jobs/analyze`** (Profile Service, que tem o catálogo): o texto vai com um JSON Schema
  estrito e instruções para usar só o que está no anúncio. O texto do anúncio é tratado como dados, e a
  resposta é validada e cortada (`job-normalize.ts`): senioridade e modalidade só de valores
  permitidos, anos entre 0 e 30, experiência sem repetidos.
- **Competências ligadas ao catálogo.** Cada tecnologia indicada pela IA é procurada no catálogo; as que
  não existem lá aparecem à parte ("Também pede: Jira"). Não se junta a procura por palavras no texto
  inteiro quando a IA respondeu, porque apanha falsos positivos (uma empresa chamada "Lumen Cloud"
  não pede Cloud).
- **Experiência pedida** é um campo novo da candidatura (lista de frases curtas), editável no formulário
  e visível no detalhe.
- **Funciona sem IA:** se a IA não responder, a análise segue pelas regras de palavras-chave de antes
  (senioridade, anos e competências) e o formulário diz porquê, sem apagar o que já estava escrito.
- **Aviso antes de enviar:** com a Groq ou a xAI, o formulário diz que o texto vai para esse serviço.

### Vagas para ti (ITJobs.pt)

A secção **Vagas** mostra vagas de entrada publicadas agora no [ITJobs.pt](https://www.itjobs.pt),
filtradas e ordenadas pelo perfil de cada utilizador. A IA não "procura" vagas (inventá-las-ia): as
vagas vêm da [API oficial do ITJobs.pt](https://itjobs.pt/api), e a IA lê-as para dizer se são realistas.

- **Recolha de 3 em 3 horas** (`JobSyncService`, Profile Service): pesquisa termos de entrada (júnior,
  estágio, trainee, graduate…), junta as repetidas pelo id e guarda-as. Ao arrancar só recolhe se a última
  recolha já passou do intervalo, por isso reiniciar o serviço não gasta pedidos.
- **Só as vagas novas são analisadas, uma vez para todos.** Triagem por palavras-chave à entrada (grátis);
  depois a IA lê até 10 vagas novas por recolha (`JOB_SYNC_AI_PER_RUN`), as mais recentes e não excluídas
  pela triagem. As outras ficam para a recolha seguinte. Se a IA não responder, tenta na próxima.
- **Vagas que desaparecem do ITJobs ficam fechadas.** Uma recolha vazia ou com erro não fecha nada.
- **Feed por utilizador** (`GET /jobs/feed`): esconde as pouco realistas, filtra por distrito ou remoto,
  tipo de contrato e stack alvo do Skill Gap, e ordena pela compatibilidade com as competências do perfil.
  Os filtros ficam guardados de uma visita para a outra.
- **Vagas novas desde a última visita:** número no menu (com os filtros dessa visita) e selo "Nova" na lista.
- **Candidatar-me** abre o anúncio no ITJobs e cria o cartão em "Candidatado", já preenchido.
  **Guardar para depois** cria-o na coluna nova **"Por candidatar"**.
- **"Por candidatar" não conta como candidatura:** fica fora do objetivo diário, do relatório semanal, da
  taxa de resposta e dos totais. Ao arrastar para outra coluna, a data da candidatura passa a ser esse dia.

Para usar: pedir a chave em <https://itjobs.pt/api> e pôr `ITJOBS_API_KEY` no `.env`. Os termos do
ITJobs.pt limitam o conteúdo a uso pessoal (cláusulas 5 e 6), por isso a app mostra só um resumo e liga sempre
ao anúncio original; antes de pôr a app online, é preciso autorização do ITJobs.pt.

### Contas de demonstração

O botão _Experimentar sem registo_ cria uma conta temporária por visitante, já preenchida, para quem
quer ver a aplicação em dois minutos (um recrutador, por exemplo).

- **Uma conta por visitante, não uma conta partilhada.** Ninguém vê nem estraga o que outro visitante
  fez, e não é preciso repor dados.
- **Cada serviço preenche a sua parte, por evento.** O Auth Service cria a conta e publica
  `user.demo-created`; o perfil e as candidaturas de exemplo são criados pelos serviços que os possuem,
  numa transação cada (o visitante vê tudo ou nada). Os dados chegam em cerca de 150 ms; o frontend
  espera por eles antes de mostrar a aplicação.
- **Os dados de exemplo mostram todos os casos:** o diagnóstico da stack full-stack tem competências
  com projeto, sem projeto, abaixo do nível e em falta; o Kanban tem candidaturas em todas as fases e
  uma vaga "júnior" que pede 3 anos. Os campos passam pelas mesmas funções que a API usa.
- **Expiração pelo mesmo caminho da eliminação.** Uma tarefa periódica apaga as contas expiradas com
  `user.deleted` (`FOR UPDATE SKIP LOCKED`, seguro com várias instâncias). O visitante também pode
  terminar a qualquer momento, sem password.
- **Limites contra abuso:** 5 demonstrações por IP a cada 10 minutos e um máximo de contas ativas
  (`DEMO_MAX_ACTIVE`, 0 desliga a funcionalidade).

Os dados de exemplo estão em `apps/profile-service/src/app/demo/demo-profile.data.ts` e
`apps/tracker-service/src/app/demo/demo-applications.data.ts`, e são fictícios.

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
- **O nginx volta a resolver o nome do gateway** (DNS do Docker, a cada 10 s). Sem isto, quando o
  gateway é recriado num deploy e muda de IP, o nginx continuaria a enviar pedidos para o endereço
  antigo e a API ficaria em 502 até alguém reiniciar o nginx.
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

| Método                | Endpoint                                                                       | Descrição                                                                                               |
| --------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `POST`                | `/api/v1/auth/register`                                                        | Cria conta, devolve access token e define o cookie                                                      |
| `POST`                | `/api/v1/auth/login`                                                           | Inicia sessão                                                                                           |
| `POST`                | `/api/v1/auth/demo`                                                            | Cria uma conta de demonstração com dados de exemplo                                                     |
| `POST`                | `/api/v1/auth/refresh`                                                         | Novo access token a partir do cookie (com rotação)                                                      |
| `POST`                | `/api/v1/auth/logout`                                                          | Revoga a sessão e limpa o cookie                                                                        |
| `GET`                 | `/api/v1/auth/me`                                                              | Utilizador autenticado 🔒                                                                               |
| `DELETE`              | `/api/v1/auth/me`                                                              | Apaga a conta e, por evento, os dados em todos os serviços (pede a password, exceto em demonstração) 🔒 |
| `GET`                 | `/api/v1/profile`                                                              | Perfil com as competências declaradas 🔒                                                                |
| `PUT`                 | `/api/v1/profile`                                                              | Atualiza título, instituição, ano e apresentação 🔒                                                     |
| `POST`/`PUT`/`DELETE` | `/api/v1/profile/education[/:id]`                                              | Formação 🔒                                                                                             |
| `POST`/`PUT`/`DELETE` | `/api/v1/profile/experience[/:id]`                                             | Experiência 🔒                                                                                          |
| `PUT`                 | `/api/v1/profile/languages`                                                    | Substitui a lista de línguas 🔒                                                                         |
| `POST`                | `/api/v1/profile/cv/analyze`                                                   | Lê o CV (multipart) e devolve um rascunho, sem gravar 🔒                                                |
| `POST`                | `/api/v1/profile/cv/import`                                                    | Grava o que o utilizador escolheu do rascunho 🔒                                                        |
| `POST`                | `/api/v1/jobs/analyze`                                                         | Lê o texto de um anúncio com IA e devolve os campos da candidatura, sem gravar 🔒                       |
| `GET`                 | `/api/v1/jobs/feed?locations=&remote=&contracts=&stackId=&includeUnrealistic=` | Vagas do ITJobs.pt filtradas e comparadas com o perfil 🔒                                               |
| `GET`                 | `/api/v1/jobs/feed/new-count`                                                  | Vagas novas desde a última visita 🔒                                                                    |
| `GET`                 | `/api/v1/jobs/feed/last-query`                                                 | Filtros da última visita 🔒                                                                             |
| `PUT`                 | `/api/v1/jobs/feed/visit`                                                      | Regista a visita (e os filtros) 🔒                                                                      |
| `PUT`                 | `/api/v1/profile/competencies/:id`                                             | Declara uma competência ou muda o nível 🔒                                                              |
| `DELETE`              | `/api/v1/profile/competencies/:id`                                             | Remove uma competência do perfil 🔒                                                                     |
| `GET`                 | `/api/v1/projects`                                                             | Projetos do utilizador 🔒                                                                               |
| `POST`                | `/api/v1/projects`                                                             | Cria um projeto 🔒                                                                                      |
| `GET`/`PUT`/`DELETE`  | `/api/v1/projects/:id`                                                         | Lê, substitui ou apaga um projeto 🔒                                                                    |
| `GET`                 | `/api/v1/projects/activity?from=&to=&tz=`                                      | Projetos criados e atualizados por dia (relatório semanal) 🔒                                           |
| `GET`                 | `/api/v1/applications/activity?from=&to=&tz=`                                  | Candidaturas, respostas e entrevistas por dia (relatório semanal) 🔒                                    |
| `GET`                 | `/api/v1/skill-gap?stackId=`                                                   | Gap calculado com o perfil guardado 🔒                                                                  |
| `GET`                 | `/api/v1/skill-gap/overview`                                                   | Compatibilidade com todas as stacks, ordenada 🔒                                                        |
| `GET`                 | `/api/v1/competencies?category=&q=`                                            | Catálogo de competências (pesquisa em nome e aliases)                                                   |
| `GET`                 | `/api/v1/competencies/:id`                                                     | Detalhe de uma competência                                                                              |
| `GET`                 | `/api/v1/stacks`                                                               | Stacks alvo                                                                                             |
| `GET`                 | `/api/v1/stacks/:id`                                                           | Detalhe de uma stack                                                                                    |
| `POST`                | `/api/v1/skill-gap/preview`                                                    | Calcula o gap sem perfil guardado                                                                       |
| `GET`                 | `/api/health`                                                                  | Estado de cada serviço (em cada porta)                                                                  |

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
- [x] Objetivo diário nos dias úteis (1 / 2 / 3) e relatório semanal com gráfico por dia
- [x] Importação do CV com IA local (Ollama) e ficha com formação, experiência, línguas e links
- [x] Análise de anúncios com IA: empresa, título, senioridade, experiência e competências
- [x] Vagas do ITJobs.pt analisadas pela IA, com filtros, vagas novas e coluna "Por candidatar"
- [x] Contas de demonstração temporárias, preenchidas por evento e apagadas ao fim de 24 horas

## Autor

Cláudio Azevedo · [LinkedIn](https://www.linkedin.com/in/claudioazevedo1) · [GitHub](https://github.com/azevedo22)
