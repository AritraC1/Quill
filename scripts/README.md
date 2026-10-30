# Scripts

Small shell helpers for local development.

| File | Purpose |
|---|---|
| [`run.sh`](./run.sh) | Starts the root `dev:server`, `dev:client`, and `dev:worker` commands in the background, then waits for them |

## Usage

Run from the repository root:

```bash
chmod +x scripts/run.sh
./scripts/run.sh
```

The script expects Bun, installed workspace dependencies, configured root `.env`, PostgreSQL, and Redis. It does not start or migrate the database. Start local dependencies with `docker compose up postgres redis`, then run `bun run migrate` before starting the API when required.

For the complete stack, see the root [README](../README.md) and `docker compose up --build`.
