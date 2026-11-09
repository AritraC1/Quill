# Scripts

Small shell helpers for local development.

| File | Purpose |
|---|---|
| [`run.sh`](./run.sh) | Starts PostgreSQL, Redis, Prometheus, and Grafana with Compose, then runs `dev:server`, `dev:worker`, and `dev:client` locally in the background |
| [`start-ai.sh`](./start-ai.sh) | Builds and starts the Python AI service with Docker Compose |

## Usage

Run from the repository root:

```bash
chmod +x scripts/run.sh
./scripts/run.sh
```

The script expects Docker Compose, Bun, installed workspace dependencies, and configured root `.env`. It starts the database and Redis containers, but does not run migrations; run `bun run migrate` before starting the API when required. It does not launch the client, API, or worker as containers.

For the complete stack, see the root [README](../README.md) and `docker compose up --build`.

To run only the AI service:

```bash
./scripts/start-ai.sh
```

The AI API is available locally at `http://127.0.0.1:8000`; its container is also reachable from other Compose services at `http://ai-service:8000`. This script does not start or connect the AI service to the TypeScript API.

---