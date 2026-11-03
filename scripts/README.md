# Scripts

Small shell helpers for local development.

| File | Purpose |
|---|---|
| [`run.sh`](./run.sh) | Starts Docker dependencies (PostgreSQL, Redis, Prometheus, Grafana), then runs `dev:server`, `dev:worker`, and `dev:client` in the background |
| [`start-ai.sh`](./start-ai.sh) | Builds and starts the Python AI service with Docker Compose |

## Usage

Run from the repository root:

```bash
chmod +x scripts/run.sh
./scripts/run.sh
```

The script expects Bun, installed workspace dependencies, configured root `.env`, PostgreSQL, and Redis. It does not start or migrate the database. Start local dependencies with `docker compose up postgres redis`, then run `bun run migrate` before starting the API when required.

For the complete stack, see the root [README](../README.md) and `docker compose up --build`.

To run only the AI service:

```bash
./scripts/start-ai.sh
```

The AI API is available locally at `http://127.0.0.1:8000`; its container is also reachable from other Compose services at `http://ai-service:8000`. This script does not start or connect the AI service to the TypeScript API.
