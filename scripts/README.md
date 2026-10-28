# scripts/

Helper shell scripts for local development.

| Script | Purpose |
|---|---|
| [`setup.sh`](./setup.sh) | One-time monorepo bootstrap — recreates workspace `package.json` files, scaffolds shared/server entry files, creates a fresh Vite React-TS client, then runs `bun install` |
| [`run.sh`](./run.sh) | Starts the three dev processes (`dev:server`, `dev:client`, `dev:worker`) in the background and waits on them |

## Usage

```bash
chmod +x scripts/*.sh      # first time only
./scripts/setup.sh
./scripts/run.sh
```

## ⚠️ Caveats

- **`setup.sh` is a historical scaffold script, not a normal installer.** It **overwrites** `packages/shared/package.json`, `apps/server/package.json`, `apps/server/src/index.ts`, and `packages/shared/src/index.ts`, losing current scripts/deps. Only run it when bootstrapping a brand-new checkout from scratch — for anything else prefer `bun install` (or `docker compose up --build`).
- **`run.sh` backgrounds processes but doesn't handle logs, shutdown, or port conflicts.** Prefer `bun run dev` from the repo root for the same effect with `--filter` handling.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.3
- A `.env` at the repo root — see `.env.example`: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (≥32 chars), `RESEND_API_KEY` (`re_…`), `VITE_API_URL`
- Local Postgres + Redis, or `docker compose up postgres redis` for the data stores

## Prefer Docker?

`docker compose up --build` from the repo root starts the entire stack (client, server, worker, postgres, redis) with no scripts needed — see the root [README](../README.md).
