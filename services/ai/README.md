# Quill AI service

The Python service in `services/ai` is a standalone recommendation and data-science workspace for Quill. The TypeScript server remains the product layer; the AI service ranks the authenticated For You feed behind a graceful fallback and also serves as a research and feature-generation workspace.

## Current status

The codebase currently includes:

- a FastAPI app in `services/ai/src/main.py` with a `/health` endpoint and the recommender router
- a `src/recommender` package with database loaders, interaction feature building, and five models: popularity (age-decayed, Bayesian-smoothed), content-based genre affinity, pure-NumPy implicit ALS (Hu/Koren/Volinsky), a hybrid blend whose content weight ramps with reading history (full trust at 12 reads), and a LightGBM LambdaRank re-ranker
- a nightly batch pipeline (`python -m recommender.pipeline.generate`, optional `--synthetic`) that trains all models and writes `recommendations.parquet`, `manifest.json`, `als.npz`, and `ranker.txt` under `src/artifacts`
- an evaluation script (`python -m recommender.scripts.run_eval`) that builds the Recall@5/Recall@10 leaderboard over a leakage-safe temporal split
- serving endpoints: `GET /recommendations/{user_id}` (limit 1–100; precomputed artifacts first, online hybrid fallback for cold or unknown users) and `GET /recommendations/meta/manifest`
- test coverage under `services/ai/tests` (47 tests across 9 files: interest, popularity, content, ALS, hybrid, ranker, features, evaluation, API)

The server integration is live: `apps/server/src/domains/blog/recommender.client.ts` calls `GET {AI_SERVICE_URL}/recommendations/{userId}` (2-second timeout) to rank the For You feed, and on any failure falls back to the application's database feed. Known caveats: the committed artifacts were generated from synthetic data, `.dockerignore` excludes artifacts from the image, and there is no durable impression log (shown-but-not-read content is invisible to the models).

## Repository layout

```text
services/ai/
├── src/
│   ├── main.py                    # FastAPI app; /health + recommender router
│   ├── recommender/
│   │   ├── data/                  # SQL-backed dataset loaders (Postgres via SQLAlchemy)
│   │   ├── features/              # interest scoring and ranker features
│   │   ├── models/                # popularity, ALS, content, hybrid, LightGBM ranker
│   │   ├── pipeline/              # nightly artifact generation job
│   │   ├── api.py                 # serving routes and response models
│   │   ├── config.py              # settings for the database connection (requires DATABASE_URL)
│   │   └── evaluate.py            # temporal train/test evaluation
│   ├── scripts/                   # evaluation entrypoint, exploration notebooks
│   └── artifacts/                 # recommendations.parquet, manifest.json, als.npz, ranker.txt
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

The container is attached to the Compose `internal` network and is resolvable by other containers as `http://ai-service:8000`. Compose injects `DATABASE_URL` pointing at the `postgres` service, so the online fallback and batch pipeline can reach the database; regenerated artifacts survive only for the container's lifetime unless the `src/artifacts` directory is mounted. The host port is bound to localhost and is not publicly exposed beyond the local machine.

## Run locally without Docker

```bash
cd services/ai
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
uvicorn main:app --app-dir src --reload --host 127.0.0.1 --port 8000
```

`config.py` requires `DATABASE_URL` from a `.env` file in `services/ai` (see `.env.example`). Regenerate artifacts with:

```bash
python -m recommender.pipeline.generate            # real database
python -m recommender.pipeline.generate --synthetic  # synthetic development world
```

Datasets, credentials, and generated artifacts should remain out of Git.

## Recommendation data work

The pipeline is built around Quill's reading signals rather than an arbitrary dataset:

- authenticated readers produce `reading_sessions` entries in the main database
- sessions store active time, maximum scroll depth, and completion state
- bookmarks and comments create additional engagement signals
- blogs carry their published metadata and genre tags

This data should not be treated as ground truth by itself. A completed scroll does not necessarily prove that a person understood or valued the story, and there is not yet a durable impression log or a post-like action in the app. Interest scores cap time credit at 600 seconds, penalise bounces (<15 s and <20% scroll), and decay with a 30-day half-life. The feed therefore treats recommendations as one ranked source with an automatic database-feed fallback rather than as a hard dependency.

## Suggested next steps

1. Collect and inspect reading-session data with varied completion and attention patterns.
2. Add durable feed-impression tracking so the model can distinguish shown stories from merely read stories.
3. Retrain artifacts on real user data (the current committed parquet is synthetic) and schedule the batch job in Compose rather than running it by hand.
4. Train the production ranker on temporally separated labels (the eval script is honest; the artifact pipeline uses same-data labels by design).
5. Keep the server's fallback path healthy and monitor recommendation latency in `/metrics`.
