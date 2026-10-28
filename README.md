# DevStart EI

Plataforma web para recém-formados em Engenharia Informática que estão a procurar o primeiro emprego.
Ajuda a responder a três perguntas:

1. **O que me falta para a vaga que procuro?** Diagnóstico de _skill gap_ face a uma stack júnior.
2. **Como provo o que sei sem experiência comercial?** Cada competência liga-se a projetos (_Proof of Work_).
3. **Em que ponto estão as minhas candidaturas?** Quadro Kanban do envio do CV até à proposta.

> Estado: em desenvolvimento. O diagnóstico de skill gap já funciona de ponta a ponta; perfil, projetos,
> autenticação e candidaturas são os próximos passos.

## Arquitetura

```
                     ┌──────────────────────┐
  Angular (web) ───▶ │  API Gateway :3000   │  /api/v1/*  → encaminha por recurso
                     └──┬─────────┬───────┬─┘
                        │         │       │
             ┌──────────▼┐ ┌──────▼─────┐ ┌▼──────────────────┐
             │ auth      │ │ profile    │ │ tracker           │
             │ :3001     │ │ :3002      │ │ :3003             │
             └───────────┘ └────────────┘ └───────────────────┘
                        ╲        │        ╱
                    libs/shared-types (contratos + lógica de gap)
```

| Projeto                | Responsabilidade                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/web`             | SPA em Angular 22 (Standalone Components, Signals, Reactive Forms, RxJS) + Bootstrap 5 / ng-bootstrap |
| `apps/api-gateway`     | Ponto de entrada único. Encaminha `/api/v1/<recurso>` para o serviço dono do recurso                  |
| `apps/auth-service`    | Registo, login e emissão de JWT                                                                       |
| `apps/profile-service` | Competências, projetos, stacks alvo e cálculo do skill gap                                            |
| `apps/tracker-service` | Candidaturas, Kanban e feedback de entrevistas                                                        |
| `libs/shared-types`    | Tipos partilhados entre frontend e backend e a função pura `calculateSkillGap`                        |

### Decisões de arquitetura

- **Monorepo Nx.** Frontend e backend partilham os mesmos contratos TypeScript: se um tipo muda, o compilador
  aponta todos os sítios afetados. O `nx affected` faz com que o CI só teste o que foi alterado.
- **Competências declaradas, não disciplinas.** O utilizador declara o que domina e o nível. As disciplinas
  variam entre cursos e dizem pouco ao mercado; as competências são o vocabulário comum de perfis, stacks e vagas.
- **Projetos como prova.** Os projetos não mudam a percentagem de compatibilidade, só organizam o resultado:
  _pronto a mostrar_, _sabes mas falta um projeto_, _abaixo do nível_ e _falta aprender_.
- **Lógica de domínio partilhada.** `calculateSkillGap` é uma função pura usada no backend e no browser,
  por isso o diagnóstico atualiza ao escrever, sem pedidos à API.
- **Catálogo com ids estáveis.** 47 competências em 8 categorias, cada uma com `aliases` para reconhecer
  termos em texto livre (ex.: "Jest" → `unit-testing`). Os seeds têm testes que impedem ids duplicados e
  referências partidas.

## Como correr

Requisitos: Node.js 22+.

```bash
npm install
npm start              # web + gateway + 3 serviços
```

- Aplicação: http://localhost:4200
- API Gateway: http://localhost:3000/api/v1

Outros comandos:

```bash
npm run start:backend  # só os serviços
npm test               # testes de todos os projetos
npm run build          # build de todos os projetos
npm run graph          # grafo de dependências do monorepo
```

As variáveis de ambiente estão documentadas em `.env.example`.

## API (implementada até agora)

| Método | Endpoint                            | Descrição                                             |
| ------ | ----------------------------------- | ----------------------------------------------------- |
| `GET`  | `/api/v1/competencies?category=&q=` | Catálogo de competências (pesquisa em nome e aliases) |
| `GET`  | `/api/v1/competencies/:id`          | Detalhe de uma competência                            |
| `GET`  | `/api/v1/stacks`                    | Stacks alvo                                           |
| `GET`  | `/api/v1/stacks/:id`                | Detalhe de uma stack                                  |
| `POST` | `/api/v1/skill-gap/preview`         | Calcula o gap sem perfil guardado                     |
| `GET`  | `/api/health`                       | Estado de cada serviço (em cada porta)                |

## Estrutura do frontend

```
apps/web/src/app/
├── core/        # singletons: configuração da API, interceptors, layout
├── shared/      # componentes reutilizáveis sem lógica de negócio
└── features/    # uma pasta por domínio, carregada sob demanda
    ├── home/
    ├── skill-gap/     # Módulo 1
    ├── profile/       # Módulo 2
    └── applications/  # Módulo 3
```

## Roadmap

- [x] Monorepo, gateway, serviços e biblioteca de tipos partilhados
- [x] Catálogo de competências e stacks alvo
- [x] Diagnóstico de skill gap (API + interface)
- [x] CI com GitHub Actions
- [ ] Auth Service: registo, login, JWT e guard no gateway
- [ ] Persistência com PostgreSQL e Docker Compose
- [ ] Perfil: competências declaradas e projetos
- [ ] Kanban de candidaturas com drag & drop
- [ ] Filtro de vagas acessíveis a quem tem 0 anos de experiência

## Autor

Cláudio Azevedo · [LinkedIn](https://www.linkedin.com/in/claudioazevedo1) · [GitHub](https://github.com/azevedo22)
