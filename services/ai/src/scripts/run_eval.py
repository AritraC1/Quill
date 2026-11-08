# scripts/run_eval.py
# One table comparing all recommendation models on an honest temporal split.
#
# Models compared:
#   1. Popularity (baseline)   — time-decayed Bayesian average
#   2. Content-Based           — personalized genre affinity with Bayesian shrinkage
#   3. ALS (Collaborative)     — matrix factorization embeddings (implicit ALS)
#   4. Hybrid                  — adaptive trust blend of Content + Popularity
#   5. Ranker (LightGBM)       — LambdaRank learning-to-rank over user/item/cross features
#
# Run:
#   python -m scripts.run_eval --synthetic
#   python -m scripts.run_eval --top-k 10

import argparse
import sys
from pathlib import Path
import pandas as pd

# Add src to sys.path so it runs standalone or as a module
SRC_DIR = Path(__file__).resolve().parents[1]
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from recommender.evaluate import (
    DEFAULT_HISTORY_FRACTION,
    DEFAULT_RELEVANCE_THRESHOLD,
    evaluate,
    filter_blogs_by_cutoff,
    suggest_cutoff,
)
from recommender.models.als import fit as fit_als, rank_user
from recommender.models.content import (
    build_content_model,
    history_size,
    make_content_model_fn,
)
from recommender.models.hybrid import rank_user_candidates
from recommender.models.popularity import (
    compute_popularity_scores,
    recommend_popular,
)
from recommender.models.ranker import (
    RankerRecommender,
    score_interactions,
)


def load_eval_data(synthetic: bool = True, **generate_kwargs) -> tuple[dict, pd.Timestamp]:
    """Load evaluation data and determine the temporal cutoff."""
    if synthetic:
        from recommender.dev.synthetic import SYNTHETIC_NOW, generate
        data = generate(**generate_kwargs)
        cutoff = suggest_cutoff(
            data["sessions"],
            data["bookmarks"],
            data["comments"],
            fraction=DEFAULT_HISTORY_FRACTION,
        )
        return data, cutoff

    try:
        from recommender.data.load import (
            load_blog_bookmarks,
            load_blogs,
            load_comments,
            load_reading_sessions,
            load_users,
        )
        data = {
            "users": load_users(),
            "blogs": load_blogs(),
            "sessions": load_reading_sessions(),
            "bookmarks": load_blog_bookmarks(),
            "comments": load_comments(),
        }
        cutoff = suggest_cutoff(
            data["sessions"],
            data["bookmarks"],
            data["comments"],
            fraction=DEFAULT_HISTORY_FRACTION,
        )
        return data, cutoff
    except Exception as e:
        print(f"Warning: Failed to load from database ({e}). Falling back to synthetic world.")
        from recommender.dev.synthetic import generate
        data = generate(**generate_kwargs)
        cutoff = suggest_cutoff(
            data["sessions"],
            data["bookmarks"],
            data["comments"],
            fraction=DEFAULT_HISTORY_FRACTION,
        )
        return data, cutoff


def build_model_factories(train: dict, cutoff: pd.Timestamp, top_k: int = 10):
    """
    Fit each candidate model ONCE on the train data at the cutoff time.
    Returns a dict mapping model_name -> (recommend_fn, description).
    """
    train_blogs = train["blogs"]
    sessions = train["sessions"]
    bookmarks = train["bookmarks"]
    comments = train["comments"]

    # 1. Popularity
    popularity_df = compute_popularity_scores(
        blogs=train_blogs,
        sessions=sessions,
        bookmarks=bookmarks,
        comments=comments,
        now=cutoff,
    )

    def popularity_fn(user_id: str, train_data: dict) -> list[str]:
        return recommend_popular(
            user_id,
            blogs=train_data["blogs"],
            sessions=train_data["sessions"],
            bookmarks=train_data["bookmarks"],
            comments=train_data["comments"],
            top_n=top_k,
            now=cutoff,
        )

    # 2. Content-Based
    content_model = build_content_model(
        train_blogs, sessions, bookmarks, comments, now=cutoff
    )
    content_fn = make_content_model_fn(
        content_model, train_blogs, sessions, bookmarks, comments, top_n=top_k
    )

    # 3. Hybrid (Content + Popularity)
    def hybrid_fn(user_id: str, train_data: dict) -> list[str]:
        if history_size(user_id, train_data["sessions"]) == 0:
            return recommend_popular(
                user_id,
                blogs=train_data["blogs"],
                sessions=train_data["sessions"],
                bookmarks=train_data["bookmarks"],
                comments=train_data["comments"],
                top_n=top_k,
                now=cutoff,
            )
        ranked = rank_user_candidates(
            user_id,
            train_data["blogs"],
            popularity_df,
            content_model,
            sessions=train_data["sessions"],
            bookmarks=train_data["bookmarks"],
            comments=train_data["comments"],
            top_n=top_k,
        )
        return ranked["blog_id"].tolist()

    # 4. Collaborative Filtering (ALS)
    als_model = fit_als(
        train_blogs, sessions, bookmarks, comments, now=cutoff
    )

    def als_fn(user_id: str, train_data: dict) -> list[str]:
        ranked = rank_user(
            als_model,
            user_id,
            train_data["blogs"],
            train_data["sessions"],
            train_data["bookmarks"],
            train_data["comments"],
            top_n=top_k,
        )
        recs = ranked["blog_id"].tolist()
        if len(recs) < top_k:
            pop = recommend_popular(
                user_id,
                blogs=train_data["blogs"],
                sessions=train_data["sessions"],
                bookmarks=train_data["bookmarks"],
                comments=train_data["comments"],
                top_n=top_k,
                now=cutoff,
            )
            seen = set(recs)
            recs.extend([b for b in pop if b not in seen])
        return recs[:top_k]

    # 5. Ranker (LightGBM LambdaRank)
    ranker = RankerRecommender(n_candidates=max(30, top_k * 2), with_als=True, num_boost_round=80)
    ranker.fit(train_blogs, sessions, bookmarks, comments, now=cutoff)
    if not sessions.empty:
        train_inter = score_interactions(sessions, bookmarks, comments, now=cutoff)
        ranker.gen_ranker_labels_and_train(train_inter)

    def ranker_fn(user_id: str, train_data: dict) -> list[str]:
        return ranker.recommend(user_id, top_n=top_k)

    return {
        "Popularity": (popularity_fn, "Baseline (Bayesian decay)"),
        "Content": (content_fn, "Personalized Genre Affinity"),
        "ALS": (als_fn, "Collaborative Filtering (Embeddings)"),
        "Hybrid": (hybrid_fn, "Content + Popularity Blend"),
        "Ranker (LGBM)": (ranker_fn, "LightGBM LambdaRank"),
    }


def run_comparison(
    synthetic: bool = True,
    top_k: int = 10,
    relevance_threshold: float = DEFAULT_RELEVANCE_THRESHOLD,
) -> pd.DataFrame:
    """Run full evaluation comparing all 5 models and print the comparison table."""
    data, cutoff = load_eval_data(synthetic=synthetic)
    sessions = data["sessions"]
    bookmarks = data["bookmarks"]
    comments = data["comments"]
    blogs = data["blogs"]

    visible_blogs = filter_blogs_by_cutoff(blogs, cutoff)
    from recommender.evaluate import split_by_time
    split = split_by_time(sessions, bookmarks, comments, cutoff)
    train_data = {**split["train"], "blogs": visible_blogs}

    print(f"\n=======================================================")
    print(f"  RECOMMENDER SYSTEM EVALUATION")
    print(f"=======================================================")
    print(f"Users: {len(data['users'])}, Total Blogs: {len(blogs)}, Cutoff: {cutoff.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Metric: Recall@{top_k} (Relevance Threshold >= {relevance_threshold})\n")

    models = build_model_factories(train_data, cutoff, top_k=top_k)

    rows = []
    for name, (fn, desc) in models.items():
        res_k = evaluate(
            fn,
            sessions=sessions,
            bookmarks=bookmarks,
            comments=comments,
            blogs=blogs,
            cutoff=cutoff,
            top_k=top_k,
            relevance_threshold=relevance_threshold,
        )
        res_5 = evaluate(
            fn,
            sessions=sessions,
            bookmarks=bookmarks,
            comments=comments,
            blogs=blogs,
            cutoff=cutoff,
            top_k=5,
            relevance_threshold=relevance_threshold,
        )
        rows.append({
            "Model": name,
            "Type / Description": desc,
            f"Recall@5": f"{res_5['recall_at_k']:.4f}",
            f"Recall@{top_k}": f"{res_k['recall_at_k']:.4f}",
            "Evaluated Users": res_k["n_users"],
            "_score": res_k["recall_at_k"],
        })

    table_df = pd.DataFrame(rows)
    sorted_df = table_df.sort_values(by="_score", ascending=False).reset_index(drop=True)
    best_model = sorted_df.iloc[0]["Model"]

    display_df = sorted_df.drop(columns=["_score"])

    # Format ASCII table
    print(display_df.to_string(index=False))
    print(f"\n🏆 Best Performing Model: {best_model} (Recall@{top_k} = {sorted_df.iloc[0][f'Recall@{top_k}']})")
    print("=======================================================\n")

    return sorted_df


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate and compare all recommendation models")
    parser.add_argument("--synthetic", action="store_true", default=True,
                        help="use synthetic world (guaranteed taste signal, no DB required)")
    parser.add_argument("--real", dest="synthetic", action="store_false",
                        help="use real database tables")
    parser.add_argument("--top-k", type=int, default=10, help="top K for Recall@K")
    parser.add_argument("--threshold", type=float, default=DEFAULT_RELEVANCE_THRESHOLD,
                        help="minimum interest score to count as relevant")
    args = parser.parse_args()

    run_comparison(synthetic=args.synthetic, top_k=args.top_k, relevance_threshold=args.threshold)

