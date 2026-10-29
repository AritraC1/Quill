# scripts/

Helper shell scripts for local development.

| Script | Purpose |
|---|---|
| [`run.sh`](./run.sh) | Starts the three dev processes (`dev:server`, `dev:client`, `dev:worker`) in the background and waits on them |

## Usage

```bash
chmod +x scripts/run.sh      # first time only
./scripts/run.sh
```

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.3
- A `.env` at the repo root — see `.env.example`: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (≥32 chars), `RESEND_API_KEY` (`re_…`), `VITE_API_URL`
- Local Postgres + Redis, or `docker compose up postgres redis` for the data stores

## Prefer Docker?

`docker compose up --build` from the repo root starts the entire stack (client, server, worker, postgres, redis) with no scripts needed — see the root [README](../README.md).
