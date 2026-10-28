# Quill Documentation

Product + engineering documentation for the Quill project.

| Document | Contents |
|---|---|
| [`API.md`](./API.md) | Full REST API reference for `apps/server` — every endpoint, request/response shape, errors, data model |
| [`PRD.md`](./PRD.md) | Product requirements, scope, priorities, current implementation status |
| [`Architecture.md`](./Architecture.md) | Implemented component breakdown, request flow, deployment topology |
| [`System-Design.md`](./System-Design.md) | Current infrastructure and future operational considerations |
| [`../CHANGE-LOG.md`](../CHANGE-LOG.md) | Chronological change log |

## Repo map

```
quill/
├── apps/
│   ├── client/        → React 19 + Vite + Tailwind v4 SPA (README inside)
│   └── server/        → Express 5 + TypeScript API (README inside)
├── packages/
│   └── shared/        → shared DTO types used by client & server (README inside)
├── scripts/
│   ├── setup.sh       → first-run environment setup
│   └── run.sh         → local dev boot (README inside)
├── docker-compose.yml → postgres + redis + server + worker + client (nginx)
├── docs/
│   ├── API.md          → REST API reference
│   ├── PRD.md          → product requirements
│   ├── Architecture.md → architecture overview
│   └── System-Design.md → current system design
└── CHANGE-LOG.md       → technical change history
```
