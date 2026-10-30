# Quill documentation

This documentation describes the checked-in implementation and labels work that is not yet wired or production-ready.

| Document | Contents |
|---|---|
| [PRD](./PRD.md) | Product scope, delivered behavior, gaps, and launch blockers |
| [Architecture](./Architecture.md) | Runtime components, request flows, and deployment topology |
| [System Design](./System-Design.md) | Data paths, background processing, operational limits, and future work |
| [API reference](./API.md) | Mounted REST endpoints, payloads, and implementation details |
| [Change log](../CHANGE-LOG.md) | Historical technical changes |

## Repository map

```text
apps/client/       React SPA and feature-oriented UI
apps/server/       Express API, PostgreSQL domains, and BullMQ workers
packages/shared/   TypeScript DTOs shared by client and server
scripts/           Local helper scripts
docker-compose.yml Local Compose topology
```

Start with the root [README](../README.md) for setup instructions. Compose applies SQL migration files automatically only when PostgreSQL initializes a new data volume; use `bun run migrate` for an existing database.
