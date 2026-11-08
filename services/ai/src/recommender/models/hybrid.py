# Hybrid
# Blend the two signals:
#   content  = "what does THIS user like" (taste, from their history)
#   popularity = "what do people like"   (social proof, time-decayed)
# Users with rich history lean on taste; users with none lean on popularity.
#
# The blend is per user, with an adaptive alpha:
#   trust = min(1, n_user_reads / full_history_reads)   — 0 with no history
#   effective alpha = alpha * trust
#   hybrid = effective_alpha * norm(content) + (1 - effective_alpha) * norm(pop)
# So a brand-new user gets pure popularity (the fallback), a heavy reader
# gets ~pure content, and everyone is somewhere in between.
#
# Normalization happens per user over their candidate set, because content
# scores (genre affinities) and popularity scores (interest × freshness)
# don't live on the same scale.

import pandas as pd

from recommender.models.content import (
    build_content_model,
    exclusions_for_user,
    history_size,
    score_interactions,
)
from recommender.models.popularity import (
    compute_popularity_scores,
    recommend_popular,
)


DEFAULT_TOP_N = 10
DEFAULT_ALPHA = 0.7           # weight taste gets at full trust
DEFAULT_FULL_HISTORY = 12     # reads at which trust saturates (matches dev generator's 12–40)
NORMALIZATION_METHODS = ("minmax", "rank")


def normalize_scores(scores: pd.Series, method: str = "minmax") -> pd.Series:
    """
    Map scores onto [0, 1].

    minmax: preserves distances, sensitive to one outlier candidate.
    rank:   only order matters — robust for lists where the absolute numbers
            of two different models aren't comparable (they aren't here).

    Constant/empty input maps to 0.5 everywhere (no information, all equal).
    """
    if len(scores) == 0:
        return scores
    if method == "minmax":
        lo, hi = scores.min(), scores.max()
        if hi == lo:
            return pd.Series(0.5, index=scores.index)
        return (scores - lo) / (hi - lo)
    if method == "rank":
        n = len(scores)
        avg_rank = scores.rank(method="average")  # ties share the FEWER-OR-EQUAL rank
        return (avg_rank - 1) / (n - 1) if n > 1 else pd.Series(0.5, index=scores.index)
    raise ValueError(f"Unknown normalization method: {method!r}")


def blend_scores(
    content: pd.Series,
    popularity: pd.Series,
    alpha: float = DEFAULT_ALPHA,
    trust: float = 1.0,
    method: str = "rank",
) -> pd.Series:
    """
    Linear blend of two candidate-side Series (aligned on blog_id index).
    `trust` in [0, 1] scales alpha down for thin-history users.
    """
    if not 0.0 <= alpha <= 1.0:
        raise ValueError(f"alpha must be within [0, 1], got {alpha}")
    effective_alpha = alpha * min(max(trust, 0.0), 1.0)
    n_content = normalize_scores(content, method)
    n_pop = normalize_scores(popularity, method)
    hybrid = effective_alpha * n_content + (1.0 - effective_alpha) * n_pop
    return hybrid.sort_values(ascending=False)


def rank_user_candidates(
    user_id: str,
    blogs: pd.DataFrame,
    popularity: pd.DataFrame,
    content_model,
    *,
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
    top_n: int = DEFAULT_TOP_N,
    alpha: float = DEFAULT_ALPHA,
    full_history: int = DEFAULT_FULL_HISTORY,
    method: str = "rank",
) -> pd.DataFrame:
    """
    Blend content and popularity for ONE user over their eligible candidates.
    Returns [blog_id, content_score, popularity_score, trust, hybrid_score]
    sorted best first.
    """
    exclude = exclusions_for_user(user_id, blogs, sessions, bookmarks, comments)
    candidates = blogs[~blogs["blog_id"].isin(exclude)]
    if candidates.empty:
        return pd.DataFrame(columns=["blog_id", "content_score", "popularity_score",
                                     "trust", "hybrid_score"])

    pop = popularity.set_index("blog_id")["popularity_score"] if not popularity.empty \
        else pd.Series(dtype=float)
    pop_assigned = pd.Series(
        candidates["blog_id"].map(pop).to_numpy(),
        index=candidates["blog_id"],
        dtype=float,
    )

    n_reads = history_size(user_id, sessions)
    trust = min(1.0, n_reads / full_history) if full_history > 0 else 1.0

    content_assigned = pd.Series(
        [content_model.score_blog(user_id, g) for g in candidates["genres"]],
        index=candidates["blog_id"],
        dtype=float,
    )

    hybrid = blend_scores(content_assigned, pop_assigned, alpha=alpha, trust=trust, method=method)
    out = pd.DataFrame({
        "blog_id": candidates["blog_id"].to_numpy(),
        "content_score": content_assigned.to_numpy(),
        "popularity_score": pop_assigned.to_numpy(),
        "trust": trust,
        "hybrid_score": hybrid.to_numpy(),
    })
    return out.sort_values("hybrid_score", ascending=False).reset_index(drop=True).head(top_n)


def recommend_hybrid(
    user_id: str,
    blogs: pd.DataFrame,
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
    *,
    top_n: int = DEFAULT_TOP_N,
    alpha: float = DEFAULT_ALPHA,
    full_history: int = DEFAULT_FULL_HISTORY,
    method: str = "rank",
    now: pd.Timestamp | None = None,
) -> list[str]:
    """
    Convenience one-shot: fit both models, blend, take the top. For batch
    jobs prefer build_content_model + compute_popularity_scores once, then
    rank_user_candidates per user.
    """
    if now is None:
        now = pd.Timestamp.now(tz="UTC")
    interactions = score_interactions(sessions, bookmarks, comments, now=now)
    if history_size(user_id, sessions) == 0:
        # No signal at all from this user — go straight to the popularity feed.
        return recommend_popular(
            user_id, blogs=blogs, sessions=sessions, bookmarks=bookmarks,
            comments=comments, top_n=top_n, now=now,
        )
    content_model = build_content_model(
        blogs, sessions, bookmarks, comments, now=now
    )
    popularity = compute_popularity_scores(
        blogs=blogs, sessions=sessions, bookmarks=bookmarks,
        comments=comments, now=now,
    )
    ranked = rank_user_candidates(
        user_id, blogs, popularity, content_model,
        sessions=sessions, bookmarks=bookmarks, comments=comments,
        top_n=top_n, alpha=alpha, full_history=full_history, method=method,
    )
    return ranked["blog_id"].tolist()


# ─── Edge: load once, wire it together ───

def load_all():
    """Both blended models read the same four tables."""
    from recommender.data.load import (
        load_blogs,
        load_reading_sessions,
        load_blog_bookmarks,
        load_comments,
    )
    return {
        "blogs": load_blogs(),
        "sessions": load_reading_sessions(),
        "bookmarks": load_blog_bookmarks(),
        "comments": load_comments(),
    }


def run_hybrid_job(user_id: str, top_n: int = DEFAULT_TOP_N):
    """Entry point for a script: load data ONCE, blend for one user."""
    data = load_all()
    recs = recommend_hybrid(user_id, **data, top_n=top_n,
                            now=pd.Timestamp.now(tz="UTC"))
    print(f"Top {top_n} for {user_id} (hybrid): {recs}")
    return recs


if __name__ == "__main__":
    import sys
    run_hybrid_job(sys.argv[1] if len(sys.argv) > 1 else "")
