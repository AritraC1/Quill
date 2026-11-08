# Generate (batch job)
# The nightly worker: for every user, produce the top-100 blogs to recommend
# and write them as ONE artifact bundle the API can serve without re-training.
#
# Pipeline:
#   1. Load everything (real DB via data/load.py, or the synthetic world with
#      --synthetic for a smoke run that needs no database).
#   2. Split interactions by TIME; fit every model on the past.
#   3. Train the LightGBM ranker to predict who will like what next. If the
#      data is too thin to train it (few users, no splits), fall back to the
#      hybrid ordering per user — still a solid feed.
#   4. Generate top-N per user (ranker where trained, hybrid otherwise).
#   5. Write artifacts/{recommendations.parquet, manifest.json, als.npz,
#      ranker.txt} — api.py reads exactly these.
#
# Run:
#   python -m recommender.pipeline.generate --synthetic       # no DB needed
#   python -m recommender.pipeline.generate --top-n 100       # real data

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from recommender.models.als import save as save_als
from recommender.models.ranker import RankerRecommender, save as save_ranker


DEFAULT_TOP_N = 100
DEFAULT_ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts"
DEFAULT_CANDIDATES_PER_USER = 60  # generator recall feeds the ranker


# ─── Steps ───

def load_data(synthetic: bool = False, **kwargs) -> dict:
    """Both full worlds implement the same four tables (+ users)."""
    if synthetic:
        from recommender.dev.synthetic import generate
        data = generate(**kwargs)
        return data

    from recommender.data.load import (
        load_blog_bookmarks,
        load_blogs,
        load_comments,
        load_reading_sessions,
        load_users,
    )
    return {
        "users": load_users(),
        "blogs": load_blogs(),
        "sessions": load_reading_sessions(),
        "bookmarks": load_blog_bookmarks(),
        "comments": load_comments(),
    }


def fit_models(data: dict, now: pd.Timestamp, with_ranker: bool = True):
    """
    Fit models on a temporally split dataset. Returns (rec, labels_meta) where
    `rec` is a fitted RankerRecommender (booster trained if possible).
    """
    sessions, bookmarks, comments = data["sessions"], data["bookmarks"], data["comments"]
    blogs = data["blogs"]

    rec = RankerRecommender(
        n_candidates=DEFAULT_CANDIDATES_PER_USER,
        with_als=True,
        num_boost_round=120,
    )
    rec.fit(blogs, sessions, bookmarks, comments, now=now)

    ranker_trained = False
    if with_ranker and sessions is not None and not sessions.empty:
        # Production job semantics: there IS no "future" at serving time, so
        # the ranker is trained on the labels "what this user strongly liked
        # in the data we have so far". Evaluation (scripts/run_eval.py) does
        # the honest temporal split instead — the two callers never share the
        # leakage rules of the other.
        interactions = _score_current(sessions, bookmarks, comments, now)
        rec.gen_ranker_labels_and_train(interactions)
        ranker_trained = rec.booster is not None

    return rec, {"ranker_trained": ranker_trained}


def _score_current(sessions, bookmarks, comments, now):
    from recommender.models.ranker import (
        build_labels,
        DEFAULT_LABEL_THRESHOLD,
        score_interactions,
    )
    inter = score_interactions(sessions, bookmarks, comments, now=now)
    return inter


def generate_for_all_users(
    data: dict,
    rec: RankerRecommender,
    *,
    now: pd.Timestamp,
    top_n: int = DEFAULT_TOP_N,
) -> pd.DataFrame:
    """Top-N blog ids per user, ranked. Cold users get the hybrid list."""
    rows = []
    engine_used = "ranker" if rec.booster is not None else "hybrid"
    for user_id in data["users"]["id"]:
        ranked_ids = rec.recommend(user_id, top_n=top_n)
        for rank, blog_id in enumerate(ranked_ids, start=1):
            rows.append({
                "user_id": user_id,
                "blog_id": blog_id,
                "rank": rank,
                "engine": engine_used,
            })
    return pd.DataFrame(rows, columns=["user_id", "blog_id", "rank", "engine"])


def write_artifacts(
    recommendations: pd.DataFrame,
    rec: RankerRecommender,
    meta: dict,
    artifacts_dir: str | Path = DEFAULT_ARTIFACTS_DIR,
) -> dict:
    """Persist the bundle: recommendations + manifest + model files."""
    artifacts = Path(artifacts_dir)
    artifacts.mkdir(parents=True, exist_ok=True)

    recs_path = artifacts / "recommendations.parquet"
    recommendations.to_parquet(recs_path, index=False)

    if rec.als_model is not None:
        save_als(rec.als_model, str(artifacts / "als.npz"))
    if rec.booster is not None:
        save_ranker(rec.booster, str(artifacts / "ranker.txt"))

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "top_n_requested": meta["top_n"],
        "n_users": int(recommendations["user_id"].nunique()) if len(recommendations) else 0,
        "n_rows": len(recommendations),
        "engine": meta["engine"],
        "ranker_trained": meta["ranker_trained"],
        "users_seen": meta.get("n_users_data", None),
        "blogs_visible": meta.get("n_blogs_data", None),
        "cutoff_now": meta["now"],
    }
    manifest_path = artifacts / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))

    return {
        "recommendations": recs_path,
        "manifest": manifest_path,
    }


def run(
    *,
    synthetic: bool = False,
    top_n: int = DEFAULT_TOP_N,
    artifacts_dir: str | Path = DEFAULT_ARTIFACTS_DIR,
    with_ranker: bool = True,
    **generate_kwargs,
) -> tuple[pd.DataFrame, dict]:
    """The full batch job."""
    now = pd.Timestamp.now(tz="UTC")
    data = load_data(synthetic=synthetic, **generate_kwargs)
    blogs = data["blogs"]
    sessions, bookmarks, comments = data["sessions"], data["bookmarks"], data["comments"]

    rec, fit_meta = fit_models(data, now=now, with_ranker=with_ranker)
    engine = "ranker" if fit_meta["ranker_trained"] else "hybrid"
    recs = generate_for_all_users(data, rec, now=now, top_n=top_n)
    written = write_artifacts(recs, rec, {
        "top_n": top_n,
        "engine": engine,
        "ranker_trained": fit_meta["ranker_trained"],
        "n_users_data": len(data["users"]),
        "n_blogs_data": len(blogs),
        "now": str(now),
    }, artifacts_dir=artifacts_dir)

    print(f"Generated {len(recs)} recommendations for {recs['user_id'].nunique()} users "
          f"({written['recommendations']})")
    print(f"Engine: {engine}")
    return recs, written


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate top-N per user + artifacts")
    parser.add_argument("--synthetic", action="store_true",
                        help="run on the synthetic world — no database needed")
    parser.add_argument("--top-n", type=int, default=DEFAULT_TOP_N)
    parser.add_argument("--artifacts-dir", type=str, default=str(DEFAULT_ARTIFACTS_DIR))
    parser.add_argument("--no-ranker", action="store_true",
                        help="skip LightGBM training; use the hybrid ordering")
    args = parser.parse_args()

    run(synthetic=args.synthetic, top_n=args.top_n,
        artifacts_dir=args.artifacts_dir, with_ranker=not args.no_ranker)
