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

## Learning path: recommendations

The first step is collecting trustworthy training signals, not fitting a model. The authenticated blog reading page sends periodic progress snapshots to the TypeScript API. Each `reading_sessions` row represents one reader/blog visit and stores the greatest active-time and scroll-depth values received, so retries do not inflate measurements. The server marks a session complete when the browser reports at least 90% scroll depth. This collection is a signal for future recommendation work; the current AI service does not read it or serve recommendations.

On an existing local database, apply the new migration from the repository root with `bun run migrate` before testing this flow. Fresh Docker databases apply the migration files during initialization.

That completion flag is only a proxy: scrolling to the bottom does not prove a person read or understood the story. Active time and scroll depth are separate features; later training-data work should compare their usefulness rather than treating either as ground truth. Sessions exist only for published blogs and authenticated readers. Bookmarks can be joined from `blog_bookmarks`; posts also have genre tags. There is not yet a durable feed-impression log or a like action on posts, so the data is not sufficient by itself for a reliable personalized ranker.

Suggested hands-on sequence:

1. Generate and inspect reading-session data with varied progress values.
2. Record which stories were actually shown in the feed, then combine those impressions with reads, bookmarks, and available blog features.
3. Build a small offline training table and inspect class balance and leakage.
4. Train and evaluate a simple baseline ranker before trying more complex ML.
5. Add a recommendation endpoint and use it to rank the existing "For you" feed, retaining a fallback for new users and service failures.