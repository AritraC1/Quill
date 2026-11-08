# Quill AI service

The Python service in `services/ai` is a standalone recommendation and data-science workspace for Quill. It is not the main application API; the TypeScript server remains the product layer, and the AI service is currently used as a separate research and feature-generation service.

## Current status

The codebase currently includes:

- a FastAPI app with a `/health` endpoint in `services/ai/src/main.py`
- a `src/recommender` package for recommendation work, including database loaders, feature generation, content/ALS/hybrid/popularity models, evaluation helpers, and artifact generation
- test coverage under `services/ai/tests` for feature-building and recommendation data pipelines

The service is still in an experimental state: there is no production recommendation endpoint exposed through the main TypeScript API, and the AI service is not yet connected to the application feed.

## Repository layout

```text
services/ai/
├── src/
│   ├── main.py                    # FastAPI app; currently /health only
│   ├── recommender/
│   │   ├── data/                  # SQL-backed dataset loaders
│   │   ├── features/              # interaction and ranking features
│   │   ├── models/                # popularity, ALS, content, hybrid, ranker
│   │   ├── pipeline/              # artifact generation jobs
│   │   ├── api.py                 # recommendation-facing helper surface
│   │   ├── config.py              # settings for the database connection
│   │   └── evaluate.py            # temporal train/test evaluation
│   ├── scripts/
│   └── artifacts/                 # generated recommendation artifacts
├── tests/
├── pyproject.toml
└── README.md
```

## Run with Docker Compose

From the repository root:

```bash
./scripts/start-ai.sh
```

This builds and runs only the `ai-service` container in the foreground. Stop it with Ctrl+C. The service listens on `http://127.0.0.1:8000`; use `/health` to check status and `/docs` for the OpenAPI UI. Set `AI_SERVICE_PORT` in the environment to change the host port.

The container is attached to the Compose `internal` network and is resolvable by other containers as `http://ai-service:8000`. The host port is bound to localhost and is not publicly exposed beyond the local machine. The TypeScript API still does not call this service yet.

## Run locally without Docker

```bash
cd services/ai
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
uvicorn main:app --app-dir src --reload --host 127.0.0.1 --port 8000
```

Datasets, credentials, and generated artifacts should remain out of Git.

## Recommendation data work

The research pipeline is built around Quill's reading signals rather than an arbitrary dataset:

- authenticated readers produce `reading_sessions` entries in the main database
- sessions store active time, maximum scroll depth, and completion state
- bookmarks and comments create additional engagement signals
- blogs carry their published metadata and genre tags

This data is useful for a future recommendation system, but it should not be treated as ground truth by itself. A completed scroll does not necessarily prove that a person understood or valued the story, and there is not yet a durable impression log or a post-like action in the app. The AI pipeline is therefore designed as a research baseline and a future feed-ranker foundation rather than as a shipped personalized feed.

## Suggested next steps

1. Collect and inspect reading-session data with varied completion and attention patterns.
2. Add durable feed-impression tracking so the model can distinguish shown stories from merely read stories.
3. Continue building the offline training and evaluation loop in `recommender/evaluate.py` and `recommender/pipeline/generate.py`.
4. Expose a recommendation endpoint only after the ranking job is stable and the app can tolerate the service dependency.
5. Put the service behind a fallback path so the main app still works if recommendation generation fails.
