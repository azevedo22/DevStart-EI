# DevStart EI

**Step by step, all the way to the first yes!**

A web platform for Computer Engineering students and recent graduates (bachelor's or master's) looking for
their first job. It keeps the search organised and motivation up, and answers three questions:

1. **What am I missing for the job I want?** A _skill gap_ diagnosis against a junior stack.
2. **How do I prove what I know without commercial experience?** Each skill links to projects (_Proof of Work_).
3. **Where are my applications at?** A Kanban board from sending the CV to the offer, with real job ads
   ranked by profile, a daily goal, a weekly report and a quote of the day from people in tech that fits
   the current moment of the search. When a company replies, you paste the email and the app suggests the
   change on the board; when it doesn't, it reminds you to follow up.

![The main screens in sequence: home page, profile, skill gap, applications board, application detail, jobs and weekly progress](docs/screenshots/demo.gif)

> **To try it without an account:** the _Experimentar sem registo_ (Try without signing up) button on the
> home page. It creates an account just for you, already filled with a sample profile, projects and
> applications, which deletes itself after 24 hours. The whole application runs in containers with one
> command (`docker compose --profile app up`) and is ready to publish on a server with HTTPS
> ([deploy guide](docs/deploy.md)).

## Screenshots

Taken with the demo account. The people, companies and jobs are fictional.

![Kanban board with applications by stage, profile match and whether the job is open to people with no experience](docs/screenshots/candidaturas.png)

**Applications.** A Kanban board from "to apply" to the offer. Each card shows the match with the profile and
whether the job is realistic for someone with no experience.

![Profile with education, experience, languages and how many skills already have a project that proves them](docs/screenshots/perfil.png)

**Profile and projects.** Education, experience and languages (entered by hand or imported from the CV), and
each skill linked to the projects that prove it. The summary shows how many already have proof and which are
the fastest way to strengthen the portfolio.

|                                                                                                                                     |                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Jobs for you: entry-level jobs ranked by profile, with the skills the person already has in green](docs/screenshots/vagas.png)    | ![Skill gap diagnosis: match with each stack and what is left to learn, by importance](docs/screenshots/skill-gap.png)                                                     |
| **Jobs for you.** Entry-level jobs read by the AI and ranked by profile. "Junior" jobs that ask for years of experience are hidden. | **Skill gap.** Match with each junior stack and what is missing, in order of importance.                                                                                   |
| ![Weekly progress: totals with comparison, chart by day, goals and reflections](docs/screenshots/progresso.png)                     | ![CV import review: details, skills with level, education and experience read by the AI](docs/screenshots/importar-cv.png)                                                 |
| **Progress.** Weekly report with a daily goal (weekdays only), comparison with the previous week and reflections.                   | **Import the CV.** The AI reads the CV and the user picks what goes into the profile. Nothing is saved without confirmation, and existing data is not replaced by default. |

## Technical highlights

- **NestJS microservices** (auth, profile, applications) behind an API Gateway, each with its own PostgreSQL
  database, and events between services with an _outbox_ and Redis Streams.
- **Angular 22 frontend** with Standalone Components, Signals and Reactive Forms. The business rules
  (skill gap, goals, weekly report) are pure functions shared with the backend in `libs/shared-types`.
- **Down-to-earth AI:** structured output with JSON Schema, the response treated as untrusted text and
  validated, a keyword fallback when the AI fails, and a cost quota per user and per day.
- **Security:** JWT validated at the gateway, session revocation, layered rate limits, uploads checked by
  their bytes, and security headers in nginx.
- **Quality:** more than 500 tests (unit and e2e against real PostgreSQL and Redis), browser tests with
  Playwright, ESLint with zero warnings, and CI on GitHub Actions that builds the Docker images and tests the
  whole stack.

## Architecture

```
                     ┌──────────────────────┐
  Angular (web) ───▶ │  API Gateway :3000   │  /api/v1/*  → routes by resource
                     │  validates the JWT   │
                     └──┬─────────┬───────┬─┘
                        │         │       │
             ┌──────────▼┐ ┌──────▼─────┐ ┌▼──────────────────┐
             │ auth      │ │ profile    │ │ tracker           │
             │ :3001     │ │ :3002      │ │ :3003             │
             └─────┬─────┘ └─────┬──────┘ └─────────┬─────────┘
                   │             │                  │
               PostgreSQL    PostgreSQL         PostgreSQL     (one database per service)
                   │             ▲                  ▲
                   └──outbox──▶ Redis Streams ──────┘          (events: user.deleted)
                        ╲        │        ╱
                    libs/shared-types (contracts + gap logic)
```

| Project                | Responsibility                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `apps/web`             | Angular 22 SPA (Standalone Components, Signals, Reactive Forms, RxJS) + Bootstrap 5 / ng-bootstrap |
| `apps/api-gateway`     | Single entry point. Validates the JWT and routes `/api/v1/<resource>` to the service that owns it  |
| `apps/auth-service`    | Sign-up, login, JWT and refresh tokens with rotation (PostgreSQL + TypeORM + migrations)           |
| `apps/profile-service` | Profile, declared skills, projects, target stacks and skill gap calculation (PostgreSQL)           |
| `apps/tracker-service` | Applications, Kanban with status history, interviews and statistics (PostgreSQL)                   |
| `libs/shared-types`    | Shared contracts and pure domain logic: `calculateSkillGap`, `analyzeJobPosting`                   |
| `libs/backend-common`  | Common code for the NestJS services: identity via the gateway, event bus (Redis Streams), config   |

### Architecture decisions

- **Nx monorepo.** Frontend and backend share the same TypeScript contracts: if a type changes, the compiler
  points to every affected place. `nx affected` makes CI test only what changed.
- **Declared skills, not courses.** The user declares what they know and at what level. Courses vary between
  degrees and say little to the job market; skills are the common vocabulary of profiles, stacks and jobs.
- **Projects as proof.** Projects don't change the match percentage, they only organise the result:
  _ready to show_, _you know it but need a project_, _below the level_ and _still to learn_.
- **Shared domain logic.** `calculateSkillGap` is a pure function used in the backend and in the browser,
  so the diagnosis updates as you type, with no API calls.
- **Projects as their own entity.** Each project's skills live in a join table (`project_competencies`),
  indexed by skill, instead of an array. Industry practices, a closed list of five values, are stored in an
  array.
- **Isolation between users.** Every query filters by owner. Another person's project returns 404, not 403,
  so it doesn't reveal that the id exists. Tested with two users in the e2e tests.
- **Explainable job ad analysis.** `analyzeJobPosting` reads the text of a job ad and extracts skills, years
  of experience and seniority, and classifies the job as _accessible_, _worth a try_ or _unrealistic_ for
  someone with zero years. It spots "junior" jobs that ask for 3+ years. It is a keyword heuristic, not AI:
  predictable, testable, and every conclusion comes with its reason. Ambiguous terms ("REST", "SOLID",
  "Spring") only count when written as a technical term, so "the rest of the team" is not a skill. The tests
  run against the real catalogue.
- **Kanban with consistent positions.** Each column keeps continuous positions (0, 1, 2…). Moving, creating
  and deleting happen in a transaction with a per-user lock (`pg_advisory_xact_lock`). An e2e test makes 20
  moves at the same time and checks that no position is repeated or skipped. In the frontend, the move is
  optimistic and rolls back if the server refuses it.
- **Accessibility is always calculated on the server**, from the years and seniority, with the same function
  the form uses for the preview. The client cannot set it.
- **Catalogue with stable ids.** 47 skills in 8 categories, each with `aliases` to recognise terms in free
  text (e.g. "Jest" → `unit-testing`). The seeds have tests that prevent duplicate ids and broken references.

### Authentication

```
 browser                    gateway                    auth-service
   │ POST /auth/login          │                            │
   │──────────────────────────▶│───────────────────────────▶│ bcrypt.compare
   │◀── access token (JSON) ───│◀── + httpOnly cookie ──────│ stores refresh hash
   │    (kept in memory)       │                            │
   │                           │                            │
   │ GET /profile + Bearer ───▶│ validates JWT              │
   │                           │ x-user-id: <id> ──────────▶ profile-service
   │                           │                            │
   │ 401 (token expired)       │                            │
   │ POST /auth/refresh ──────▶│───────────────────────────▶│ rotates the token:
   │◀── new access token ──────│◀── new cookie ─────────────│ revokes the old one
```

- **Access token in memory, refresh token in an `httpOnly` cookie.** An injected script can read neither of
  them. The cookie is `SameSite=Strict` and is only sent to `/api/v1/auth`.
- **Rotation with theft detection.** Each refresh revokes the token used. If an already used token shows up
  again, the whole session is revoked. In the frontend, parallel requests share a single refresh, so the
  user is not mistaken for an attacker.
- **Gateway as the boundary.** It validates the JWT before routing and passes the identity in `x-user-id`. It
  always removes that header from the original request, so a client cannot forge it. A route is only public
  if it is explicitly on the list: forgetting an entry closes it, never opens it.
- **Credential protection.** Passwords with bcrypt, the same response for an unknown email and a wrong
  password (also in response time), and a limit of 10 attempts per minute on login and sign-up.
- **Layered rate limits.** The gateway accepts up to 300 requests per minute per person (per user with a
  session, per IP without one), against scripts and loops in the frontend. The AI has its own quota because
  of cost: 20 reads (CVs and job ads) per hour per user and 300 per day in total, because demo accounts are
  created without sign-up. Everything is configurable in `.env` and the 429 says how long to wait.
- **Shared rules.** The password rules come from `libs/shared-types` and are validated in the form and on the
  server with the same criteria.

### Events between services

When someone deletes their account, the data lives in three different databases. The Auth Service doesn't
call the other services: it publishes a `user.deleted` event and each service handles its own data.

```
 auth-service                         Redis Streams                profile / tracker
 ┌───────────────────────────┐        ┌──────────────┐           ┌──────────────────────┐
 │ BEGIN                     │        │              │  group    │ deletes that user's  │
 │  DELETE users             │ relay  │ devstart:    │ ────────▶ │ data (idempotent)    │
 │  INSERT outbox_events     │ ─────▶ │ events       │  XACK     │ and confirms         │
 │ COMMIT                    │        │              │ ◀──────── │                      │
 └───────────────────────────┘        └──────────────┘           └──────────────────────┘
```

- **Transactional outbox.** The event is saved in the same transaction that deletes the user. A _relay_
  publishes it to Redis and retries until it succeeds. If Redis is down at that moment, nothing is lost.
- **Redis Streams with consumer groups, not pub/sub.** Each service has its own group and acknowledges each
  event (`XACK`) only after handling it. A service that was down receives the events when it comes back.
  Tested: with the tracker turned off, the account was deleted and the applications disappeared when it
  started.
- **At-least-once delivery.** The handlers are idempotent (deleting twice = deleting once). An event that
  fails 5 times goes to a _dead-letter_ queue instead of blocking the next ones.
- **Revoked tokens.** Access tokens are stateless and would stay valid until they expire. When an account is
  deleted, the Auth Service marks the user as revoked in Redis for 15 minutes (the token's lifetime) and the
  gateway rejects those tokens. Without this, an old token could create data again for a deleted account.

### Daily goal and weekly report

**On weekdays**, a small goal of applications: **1 is enough, 2 is good, 3 is very good**. It shows at the
top of Applications and on the home page, with how much is left for the next level, the streak of
consecutive weekdays, the week from Monday to Sunday and a small celebration when you reach a new level.
**There is no goal at the weekend:** the card points to the report.

The **Progress** page (`/progress`) is the report for the week:

- **Day-by-day chart** (Monday to Sunday): applications, positive replies, rejections, interviews and
  projects, with each day's numbers on mouse hover or with the keyboard.
- **List by day**, in text: "Tuesday: 2 applications · 1 positive reply", with each event (company, new
  stage, 1st or 2nd interview of the process, project).
- **Totals compared with the previous week**, **weekly goals** (15 applications, the daily goal on all 5
  weekdays, at least one new or updated project) and, at the weekend or in past weeks, notes **to reflect
  on**. You can go back week by week.

How it works:

- **Replies** are column changes on the Kanban, already saved in the history: moving from "Candidatado"
  (Applied) to an interview stage (or moving to the next stage) is a positive reply; "Proposta" (Offer) and
  "Rejeitado" (Rejected) count separately; moving back to "Candidatado" to fix a mistake doesn't count.
- **Each service provides its part.** `GET /applications/activity` (tracker) and `GET /projects/activity`
  (profile) return the events in a range, with the day calculated in PostgreSQL in the **user's time zone**
  (`AT TIME ZONE`): a reply at 23:30 counts on that day. The browser joins the two, and the report is a pure,
  shared and tested function (`weeklyReport` in `libs/shared-types`).
- **Projects:** the day they were created and the day of the last update are counted (only the last one is
  stored).
- **The daily goal is instant:** it is calculated in the browser from the board, so it updates the moment an
  application is created, and resets by itself at midnight.

### Company replies and silence

- **"Recebi uma resposta" (I got a reply):** the person pastes the email; the AI says whether it is a
  rejection, interview, technical test or offer, for which application (only among the ones waiting, sent
  with the request) and for when. The id the AI returns must be one of those sent, and the date must exist
  and fall within a plausible range; otherwise, the application is matched by the company name in the text
  or left for the person to choose. Without AI, it falls back to keywords (PT and EN). Nothing changes
  without "Aplicar" (Apply), and the text is not stored.
- **Silence:** with no reply for 14 days, the application shows a ready-made follow-up (PT/EN) to copy or
  open in your email; at 30 days, it suggests archiving it as "Sem resposta" (No reply). The deadlines are
  based on the median of ~1 week until the first reply and the usual advice to wait 1 to 2 weeks before a
  follow-up. "Sem resposta" doesn't count as a rejection in the reply rate, and a late reply takes the card
  out of that column.

### Profile photo

On the profile, a click on the photo (or the initials) uploads a photo, which also shows in the menu.

- **Prepared in the browser before leaving the computer:** cropped to a centred square, scaled down to
  512×512 and re-encoded as JPEG (`prepare-photo.ts`). A phone photo of several MB ends up at tens of KB,
  and re-encoding **removes the EXIF metadata**, which may hold the GPS location where it was taken.
- **Stored in the Profile Service** (`PUT`/`GET`/`DELETE /profile/photo`), in a separate table so the profile
  doesn't carry the image. The server accepts up to 1 MB and only JPEG, PNG or WebP, checked by the first
  bytes (not by the name or the Content-Type), and serves it with the checked type, `nosniff` and no shared
  cache.
- **Only the owner can see it.** Since an `<img>` doesn't send the session token, the browser requests the
  photo with the token and shows it from a local URL (`blob:`). Deleting the account deletes the photo.

### Quote of the day

At the top of the home page and the Kanban, one quote per day from people who built technology and tech
companies (Steve Jobs, Jensen Huang, Grace Hopper, Linus Torvalds, Satya Nadella, Melanie Perkins…), so
that people looking for their first opportunity don't give up.

- **Only quotes with a verifiable source** (speech, interview, book), linked in the quote itself. Many quotes
  shared online are made up; these were checked one by one.
- **In the original language, with translation on request.** The quote shows the exact words of the person
  who said it; "traduzir para português" (translate to Portuguese) shows a free translation, and the choice
  is remembered on the following days.
- **It fits the moment:** after a rejection, quotes about persistence; after a positive reply or a scheduled
  interview, about growing and taking risks; at the weekend, to reflect. The context comes from the Kanban
  history of the last few days (the same as the weekly report), not from the cards' edit date.
- **One per day, the same all day,** and it only repeats after all of them have been shown. It can be hidden
  until the next day. List and rules in `libs/shared-types` (`daily-quote.ts`), tested.

### Import the CV with AI

A new account starts on the profile, with a button to import the CV (PDF or DOCX). A language model (local
with [Ollama](https://ollama.com), or in the cloud with Groq or xAI) reads the CV and fills in the profile:
title, location, links, education, experience, languages, skills and projects.

- **Two steps, nothing saved without confirmation.** `POST /profile/cv/analyze` returns a draft; the user
  picks and corrects what goes in, and only `POST /profile/cv/import` saves it, in a transaction. What is
  already in the profile comes unticked: the import never replaces data without the user choosing, and
  importing the same CV twice doesn't duplicate anything.
- **The file is not stored.** It stays in memory during the request; the format is checked by the first
  bytes, not by the extension.
- **Structured output.** The model must answer following a JSON Schema, with temperature 0. Even so, the
  response is treated as untrusted text: dates, years, links and levels are validated and normalised
  (`cv-normalize.ts`), and technologies are mapped to the catalogue with the same keyword detection as the
  job ad analysis.
- **Three providers, chosen in `.env`.** `LLM_PROVIDER=ollama` (local, free, the CV never leaves the
  computer), `groq` or `xai` (OpenAI-compatible APIs: faster and more accurate, but the CV is sent out; the
  review screen warns the user). If a model doesn't accept the strict schema, the client retries in plain
  JSON mode. On startup, the service checks the key and the model, and detects keys mixed up between
  providers (Groq and Grok are often confused). The rest of the code only knows the `StructuredLlm`
  interface (in `apps/profile-service/src/app/ai/`, shared with the job ad analysis).
- **Works without AI.** If the provider doesn't respond (Ollama stopped, model not installed, wrong key), the
  analysis returns what the keywords find (skills and links) and says why.

To use it: with Ollama, install the model (`ollama pull qwen2.5:7b`, or another set in `OLLAMA_MODEL`); with
Groq or xAI, set `LLM_PROVIDER` and the matching key (`GROQ_API_KEY`, `XAI_API_KEY`) in `.env`.

### Analyse job ads with AI

In _Nova candidatura_ (New application), the user pastes the text of the job ad and clicks **Analisar**
(Analyse). The same AI that reads CVs fills in **company, job title, seniority, years and types of
experience required and skills**, plus the work mode and location when the ad mentions them. Nothing is
saved until you click save.

- **`POST /jobs/analyze`** (Profile Service, which holds the catalogue): the text is sent with a strict JSON
  Schema and instructions to use only what is in the ad. The ad text is treated as data, and the response is
  validated and trimmed (`job-normalize.ts`): seniority and work mode only from allowed values, years between
  0 and 30, experience without duplicates.
- **Skills linked to the catalogue.** Each technology the AI returns is looked up in the catalogue; those that
  aren't there are shown separately ("Também pede: Jira", i.e. "Also asks for: Jira"). A keyword search over
  the whole text is not added when the AI has answered, because it catches false positives (a company called
  "Lumen Cloud" isn't asking for Cloud).
- **Experience required** is a new field on the application (a list of short phrases), editable in the form
  and shown in the detail view.
- **Works without AI:** if the AI doesn't respond, the analysis falls back to the earlier keyword rules
  (seniority, years and skills) and the form says why, without erasing what was already written.
- **Warning before sending:** with Groq or xAI, the form says the text is going to that service.

### Jobs for you (ITJobs.pt)

The **Vagas** (Jobs) section shows entry-level jobs currently published on [ITJobs.pt](https://www.itjobs.pt),
filtered and ranked by each user's profile. The AI doesn't "search" for jobs (it would make them up): the
jobs come from the [official ITJobs.pt API](https://itjobs.pt/api), and the AI reads them to say whether
they are realistic.

- **Collected every 3 hours** (`JobSyncService`, Profile Service): it searches for entry-level terms (junior,
  internship, trainee, graduate…), merges duplicates by id and stores them. On startup it only collects if
  the interval since the last run has passed, so restarting the service doesn't waste requests.
- **Only new jobs are analysed, once for everyone.** Keyword screening on arrival (free); then the AI reads up
  to 10 new jobs per run (`JOB_SYNC_AI_PER_RUN`), the most recent ones not excluded by the screening. The
  rest wait for the next run. If the AI doesn't respond, it tries again next time.
- **Jobs that disappear from ITJobs are closed.** An empty or failed run closes nothing.
- **Per-user feed** (`GET /jobs/feed`): hides the unrealistic ones, filters by district or remote, contract
  type and Skill Gap target stack, and ranks by match with the profile's skills. The filters are kept from one
  visit to the next.
- **New jobs since the last visit:** a number in the menu (with that visit's filters) and a "Nova" (New) badge
  in the list.
- **Candidatar-me** (Apply) opens the ad on ITJobs and creates the card in "Candidatado" (Applied), already
  filled in. **Guardar para depois** (Save for later) creates it in the new **"Por candidatar"** (To apply)
  column.
- **"Por candidatar" doesn't count as an application:** it is left out of the daily goal, the weekly report,
  the reply rate and the totals. When dragged to another column, the application date becomes that day.

To use it: request a key at <https://itjobs.pt/api> and set `ITJOBS_API_KEY` in `.env`. The ITJobs.pt terms
limit the content to personal use (clauses 5 and 6), so the app only shows a summary and always links to the
original ad; before putting the app online, permission from ITJobs.pt is needed.

### Demo accounts

The _Experimentar sem registo_ (Try without signing up) button creates a temporary, pre-filled account per
visitor, for anyone who wants to see the application in two minutes (a recruiter, for example).

- **One account per visitor, not a shared account.** Nobody sees or breaks what another visitor did, and
  there is no data to reset.
- **Each service fills in its part, by event.** The Auth Service creates the account and publishes
  `user.demo-created`; the sample profile and applications are created by the services that own them, in one
  transaction each (the visitor sees all or nothing). The data arrives in about 150 ms; the frontend waits for
  it before showing the application.
- **The sample data shows every case:** the full-stack diagnosis has skills with a project, without a project,
  below the level and missing; the Kanban has applications in every stage and a "junior" job that asks for 3
  years. The fields go through the same functions the API uses.
- **Expiry uses the same path as deletion.** A periodic task deletes expired accounts with `user.deleted`
  (`FOR UPDATE SKIP LOCKED`, safe with several instances). The visitor can also end it at any time, without
  a password.
- **Abuse limits:** 5 demos per IP every 10 minutes and a maximum number of active accounts
  (`DEMO_MAX_ACTIVE`, 0 turns the feature off).

The sample data is in `apps/profile-service/src/app/demo/demo-profile.data.ts` and
`apps/tracker-service/src/app/demo/demo-applications.data.ts`, and it is fictional.

### Redis: what it stores and what happens if it fails

| Use                                                            | If Redis fails                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Events between services                                        | They stay in the outbox and are published when Redis comes back                       |
| Rate limiting and AI quota counters (shared between instances) | Lets requests through and logs it (_fail-open_): a Redis failure doesn't block logins |
| Token revocation                                               | Lets requests through: tokens expire by themselves in 15 minutes                      |

The skills and stacks catalogue uses HTTP caching (`Cache-Control` + `ETag`): the browser keeps it for 5
minutes and then revalidates; with no changes, the response is a `304` with no body.

### In containers

```
 browser ──▶ nginx :8080 ──┬── /        → Angular static files
                           └── /api/... → api-gateway → auth / profile / tracker
                                                              │
                                                    PostgreSQL + Redis
```

- **Only nginx has a published port.** The services, the gateway, PostgreSQL and Redis stay on Docker's
  internal network. The frontend and the API share the same origin: no CORS, and the `SameSite=Strict`
  cookie works with no exceptions.
- **One multi-stage Dockerfile for the 5 images.** The NestJS services are built the same way, and the
  monorepo's `npm ci` sits in a shared layer: after the first image, the others build in seconds. Each final
  image carries only the service bundle and the dependencies it imports (about 50 MB instead of the
  monorepo's hundreds), and runs as an unprivileged user.
- **nginx re-resolves the gateway's name** (Docker DNS, every 10 s). Without this, when the gateway is
  recreated in a deploy and changes IP, nginx would keep sending requests to the old address and the API
  would return 502 until someone restarted nginx.
- **Healthchecks and startup order.** Each service only starts after PostgreSQL and Redis are healthy, the
  gateway after the services, and nginx after the gateway.
- **Security headers in nginx**, including a Content Security Policy that only allows scripts from the same
  origin.
- **The client's real IP passes through the proxies.** Rate limiting counts attempts per IP. Behind nginx and
  the gateway, the auth-service reads the IP from `X-Forwarded-For`, skipping the right number of proxies
  (`TRUST_PROXY_HOPS`); the gateway does the same, with one hop less. With the wrong value, every request
  would seem to come from nginx, and 10 failed logins from one person would block everyone. An
  `X-Forwarded-For` forged by the client changes nothing.
- **Smoke test in CI.** A job builds the images, starts the whole stack and walks through it via nginx
  (`tools/smoke-test.sh`): frontend, headers, sign-up, the three services, account deletion and token
  revocation.
- **Browser tests (Playwright) in CI.** In the same job, against the same stack, a browser follows three paths
  of a real person: trying the demo and ending it, creating an application and moving it to another column,
  and editing the profile. Each test creates its own account; if one fails, CI keeps the report with
  screenshots and the trace.

## How to run

Requirements: Node.js 24 with npm 11 (the version is in `.nvmrc`; with nvm, `nvm use`) and Docker (for
PostgreSQL). `npm install` refuses other versions, so the `package-lock.json` format doesn't change.

```bash
npm install
cp .env.example .env
docker compose up -d      # PostgreSQL (one database per service) and Redis
npm start                 # web + gateway + 3 services
```

Migrations run automatically when each service starts.

- Application: http://localhost:4200
- API Gateway: http://localhost:3000/api/v1

Other commands:

```bash
npm run start:backend  # services only
npm test               # tests for all projects
npm run lint           # ESLint on all projects (warnings fail too)
npm run e2e            # browser tests (Playwright) against the app already running on :8080
TEST_DATABASE_URL=postgres://devstart:devstart@localhost:5432/devstart_test \
TEST_REDIS_URL=redis://localhost:6379 npm test
                       # includes the e2e tests against PostgreSQL and Redis (skipped without these variables)
npm run build          # build all projects
npm run graph          # monorepo dependency graph
```

The environment variables are documented in `.env.example`.

### Run everything with Docker

To see the application as in production, without installing Node.js:

```bash
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 48)" >> .env
docker compose --profile app up -d --build   # first time: a few minutes
tools/smoke-test.sh                          # optional: checks the stack end to end
```

- Application: http://localhost:8080

If you had already run the development mode, the PostgreSQL volume is reused (with the migrations applied on
top). To start from scratch: `docker compose --profile app down -v`.

If startup stops with "container … is unhealthy", the reason is in the service's log:

```bash
docker compose --profile app logs auth-service --tail 20
```

The most common cause is a missing `JWT_ACCESS_SECRET` in `.env` (the message says exactly that).

To publish on a server with a domain and HTTPS, see [docs/deploy.md](docs/deploy.md).

## API (implemented so far)

| Method                | Endpoint                                                                       | Description                                                                                             |
| --------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `POST`                | `/api/v1/auth/register`                                                        | Creates an account, returns the access token and sets the cookie                                        |
| `POST`                | `/api/v1/auth/login`                                                           | Logs in                                                                                                 |
| `POST`                | `/api/v1/auth/demo`                                                            | Creates a demo account with sample data                                                                 |
| `POST`                | `/api/v1/auth/refresh`                                                         | New access token from the cookie (with rotation)                                                        |
| `POST`                | `/api/v1/auth/logout`                                                          | Revokes the session and clears the cookie                                                               |
| `GET`                 | `/api/v1/auth/me`                                                              | Authenticated user 🔒                                                                                   |
| `DELETE`              | `/api/v1/auth/me`                                                              | Deletes the account and, by event, the data in every service (asks for the password, except in demo) 🔒 |
| `GET`                 | `/api/v1/profile`                                                              | Profile with the declared skills 🔒                                                                     |
| `PUT`                 | `/api/v1/profile`                                                              | Updates title, institution, year and bio 🔒                                                             |
| `POST`/`PUT`/`DELETE` | `/api/v1/profile/education[/:id]`                                              | Education 🔒                                                                                            |
| `POST`/`PUT`/`DELETE` | `/api/v1/profile/experience[/:id]`                                             | Experience 🔒                                                                                           |
| `PUT`                 | `/api/v1/profile/languages`                                                    | Replaces the list of languages 🔒                                                                       |
| `POST`                | `/api/v1/profile/cv/analyze`                                                   | Reads the CV (multipart) and returns a draft, without saving 🔒                                         |
| `POST`                | `/api/v1/profile/cv/import`                                                    | Saves what the user picked from the draft 🔒                                                            |
| `GET`/`PUT`/`DELETE`  | `/api/v1/profile/photo`                                                        | Profile photo (PUT multipart, field "file"; up to 1 MB, JPEG/PNG/WebP) 🔒                               |
| `POST`                | `/api/v1/jobs/analyze`                                                         | Reads the text of a job ad with AI and returns the application fields, without saving 🔒                |
| `GET`                 | `/api/v1/jobs/feed?locations=&remote=&contracts=&stackId=&includeUnrealistic=` | ITJobs.pt jobs filtered and compared with the profile 🔒                                                |
| `GET`                 | `/api/v1/jobs/feed/new-count`                                                  | New jobs since the last visit 🔒                                                                        |
| `GET`                 | `/api/v1/jobs/feed/last-query`                                                 | Filters from the last visit 🔒                                                                          |
| `PUT`                 | `/api/v1/jobs/feed/visit`                                                      | Records the visit (and the filters) 🔒                                                                  |
| `PUT`                 | `/api/v1/profile/competencies/:id`                                             | Declares a skill or changes its level 🔒                                                                |
| `DELETE`              | `/api/v1/profile/competencies/:id`                                             | Removes a skill from the profile 🔒                                                                     |
| `GET`                 | `/api/v1/projects`                                                             | The user's projects 🔒                                                                                  |
| `POST`                | `/api/v1/projects`                                                             | Creates a project 🔒                                                                                    |
| `GET`/`PUT`/`DELETE`  | `/api/v1/projects/:id`                                                         | Reads, replaces or deletes a project 🔒                                                                 |
| `GET`                 | `/api/v1/projects/activity?from=&to=&tz=`                                      | Projects created and updated per day (weekly report) 🔒                                                 |
| `GET`                 | `/api/v1/applications/activity?from=&to=&tz=`                                  | Applications, replies and interviews per day (weekly report) 🔒                                         |
| `GET`                 | `/api/v1/skill-gap?stackId=`                                                   | Gap calculated with the saved profile 🔒                                                                |
| `GET`                 | `/api/v1/skill-gap/overview`                                                   | Match with every stack, sorted 🔒                                                                       |
| `GET`                 | `/api/v1/competencies?category=&q=`                                            | Skills catalogue (search in name and aliases)                                                           |
| `GET`                 | `/api/v1/competencies/:id`                                                     | Skill detail                                                                                            |
| `GET`                 | `/api/v1/stacks`                                                               | Target stacks                                                                                           |
| `GET`                 | `/api/v1/stacks/:id`                                                           | Stack detail                                                                                            |
| `POST`                | `/api/v1/skill-gap/preview`                                                    | Calculates the gap without a saved profile                                                              |
| `GET`                 | `/api/health`                                                                  | Status of each service (on each port)                                                                   |

🔒 requires `Authorization: Bearer <token>`. Everything not in this table is also protected by default.

## Frontend structure

```
apps/web/src/app/
├── core/        # singletons: session, catalogue, profile state, interceptors, guards, layout
├── shared/      # reusable components with no business logic
└── features/    # one folder per domain, lazy-loaded
    ├── home/
    ├── auth/          # login and sign-up
    ├── skill-gap/     # Module 1: diagnosis (with the saved profile or as a simulation)
    ├── profile/       # Module 2: profile, skills and projects
    └── applications/  # Module 3: Kanban with drag & drop (Angular CDK), job ad analysis and interviews
```

## Roadmap

- [x] Monorepo, gateway, services and shared types library
- [x] Skills catalogue and target stacks
- [x] Skill gap diagnosis (API + interface)
- [x] CI with GitHub Actions (with PostgreSQL for the e2e tests)
- [x] Auth Service: sign-up, login, JWT, refresh with rotation and validation at the gateway
- [x] PostgreSQL with migrations and Docker Compose
- [x] Docker images, `docker compose` for the whole application and smoke test in CI
- [ ] Online publishing (HTTPS setup ready: [docs/deploy.md](docs/deploy.md))
- [x] Profile: declared skills and projects (Proof of Work)
- [x] Diagnosis with the saved data and ranking of the closest stacks
- [x] Applications Kanban with drag & drop, status history and interviews with feedback
- [x] Job ad analysis and filter for jobs open to people with 0 years of experience
- [x] Events between services (Redis Streams + outbox) and account deletion across all services
- [x] Shared rate limiting in Redis, token revocation and HTTP caching for the catalogue
- [x] Daily goal on weekdays (1 / 2 / 3) and weekly report with a chart by day
- [x] CV import with AI (local Ollama, Groq or xAI) and a profile with education, experience, languages and links
- [x] Job ad analysis with AI: company, title, seniority, experience and skills
- [x] ITJobs.pt jobs analysed by the AI, with filters, new jobs and a "Por candidatar" (To apply) column
- [x] Quote of the day from people in tech, with a source, matched to the moment of the search
- [x] Profile photo, prepared in the browser (512×512, no GPS metadata)
- [x] Temporary demo accounts, filled in by event and deleted after 24 hours

## Author

Cláudio Azevedo · [LinkedIn](https://www.linkedin.com/in/claudioazevedo1) · [GitHub](https://github.com/azevedo22)
