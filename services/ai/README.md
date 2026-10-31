# Quill AI service

The Python service is under `services/ai/src`. Its current API exposes `/health`; model training and inference are not yet implemented.

## Run with Docker Compose

From the repository root:

```bash
./scripts/start-ai.sh
```

This builds and starts only the `ai-service` container in the foreground. Stop it with Ctrl+C. The service is available at `http://127.0.0.1:8000`; use `/health` to check status and `/docs` for the local API page. Set `AI_SERVICE_PORT` in the environment to change the host port.

The container is also attached to the Compose `internal` network and is resolvable by other containers as `http://ai-service:8000`. The host port is bound to localhost, not exposed on all network interfaces. The TypeScript API does not call this service yet.

## Run locally without Docker

```bash
cd services/ai
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
uvicorn main:app --app-dir src --reload --host 127.0.0.1 --port 8000
```

Datasets, credentials, and generated model artifacts should remain out of Git.
