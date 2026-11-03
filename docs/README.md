# Quill documentation

This documentation describes the checked-in implementation and distinguishes working features from development limitations and production work.

| Document | Contents |
|---|---|
| [PRD](./PRD.md) | Product scope, delivered behavior, gaps, and launch blockers |
| [Architecture](./Architecture.md) | Runtime components, request flows, and deployment topology |
| [Observability](./Observability.md) | Prometheus metrics, Grafana dashboards, Sentry error tracking, health endpoints |
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

Start with the root [README](../README.md) for setup instructions. Compose applies migration SQL through PostgreSQL's init mechanism only when initializing a new data volume; use `bun run migrate` for an existing database. Read the API reference and current implementation docs together: not every feature is available without authentication, and the OTP flow still uses a fixed development code.
