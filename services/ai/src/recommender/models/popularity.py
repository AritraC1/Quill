# Popularity
# Rank blogs by how much people liked them overall, with no personalization.
# Every user gets the same list, minus blogs they've already read.
# Note: It's the fallback for brand-new users who have no history

import pandas as pd
from recommender.features.interest import build_interactions, interest_score


DEFAULT_HALF_LIFE_DAYS = 30
DEFAULT_PRIOR_STRENGTH = 5
DEFAULT_TOP_N = 10


# ─── Middle: Pure computation (no DB access) ───

def compute_popularity_scores(
    blogs: pd.DataFrame,
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
    half_life_days: float = DEFAULT_HALF_LIFE_DAYS,
    prior_strength: int = DEFAULT_PRIOR_STRENGTH,
    now: pd.Timestamp | None = None,
) -> pd.DataFrame:
    """
    Compute a single popularity score per blog.

    Starts from ALL published blogs (left-join stats) so new/unseen blogs
    get a fair chance. Uses a Bayesian average (shrunk toward global mean)
    with `prior_strength` as the pseudo-count.

    Time decay is applied ONCE here, based on publication date.
    (interest_score already decays individual interactions by their age.)
    """
    if now is None:
        now = pd.Timestamp.now(tz="UTC")

    # Build (user, blog) interactions and compute interest scores
    interactions = build_interactions(sessions, bookmarks, comments)
    if interactions.empty:
        # No interactions at all: every blog gets global mean * freshness
        blogs = blogs.copy()
        blogs["published_at"] = pd.to_datetime(blogs["published_at"], utc=True)
        age_days = (now - blogs["published_at"]).dt.total_seconds() / 86400
        blogs["popularity_score"] = 0.5 ** (age_days / half_life_days) * 0.5  # global_mean ≈ 0.5
        return blogs[["blog_id", "popularity_score"]].assign(
            n_interactions=0, mean_interest=0.0
        ).sort_values("popularity_score", ascending=False).reset_index(drop=True)

    interactions["interest"] = interest_score(interactions, now, half_life_days)

    # Aggregate per blog
    blog_stats = interactions.groupby("blog_id").agg(
        n_interactions=("interest", "count"),
        mean_interest=("interest", "mean"),
    ).reset_index()

    # Start from ALL blogs, left-join stats (key fix: new blogs stay in)
    blog_stats = blogs[["blog_id", "published_at", "user_id"]].merge(
        blog_stats, on="blog_id", how="left"
    )

    # Fill missing: no interactions → n=0, mean=NaN (will be replaced by prior)
    blog_stats["n_interactions"] = blog_stats["n_interactions"].fillna(0).astype(int)
    # mean_interest stays NaN for no-interaction blogs

    # Global prior for Bayesian average
    global_mean = blog_stats["mean_interest"].mean()
    if pd.isna(global_mean):
        global_mean = 0.5  # fallback if literally no interactions exist

    # Bayesian average: weight = n / (n + prior_strength)
    # Blogs with 0 interactions get weight=0 → score = global_mean
    blog_stats["weight"] = blog_stats["n_interactions"] / (blog_stats["n_interactions"] + prior_strength)
    blog_stats["bayesian_score"] = (
        blog_stats["weight"] * blog_stats["mean_interest"].fillna(global_mean) +
        (1 - blog_stats["weight"]) * global_mean
    )

    # Time decay based on publication date (applied ONCE here)
    blog_stats["published_at"] = pd.to_datetime(blog_stats["published_at"], utc=True)
    age_days = (now - blog_stats["published_at"]).dt.total_seconds() / 86400
    blog_stats["time_decay"] = 0.5 ** (age_days / half_life_days)

    # Final popularity score
    blog_stats["popularity_score"] = blog_stats["bayesian_score"] * blog_stats["time_decay"]

    return blog_stats.sort_values("popularity_score", ascending=False).reset_index(drop=True)[
        ["blog_id", "popularity_score", "n_interactions", "mean_interest", "published_at", "user_id"]
    ]


def get_user_read_blogs(
    user_id: str,
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
) -> set[str]:
    """
    Get set of blog_ids the user has already interacted with.
    Pure function — takes pre-loaded DataFrames.
    """
    read_blogs = set()

    if not sessions.empty:
        read_blogs.update(sessions.loc[sessions["user_id"] == user_id, "blog_id"].unique())
    if not bookmarks.empty:
        read_blogs.update(bookmarks.loc[bookmarks["user_id"] == user_id, "blog_id"].unique())
    if not comments.empty:
        read_blogs.update(comments.loc[comments["user_id"] == user_id, "blog_id"].unique())

    return read_blogs


def get_user_owned_blogs(user_id: str, blogs: pd.DataFrame) -> set[str]:
    """Get blog_ids authored by the user (to exclude from recommendations)."""
    if blogs.empty:
        return set()
    return set(blogs.loc[blogs["user_id"] == user_id, "blog_id"].unique())


def filter_recommendations(
    popularity: pd.DataFrame,
    user_id: str,
    blogs: pd.DataFrame,
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
    top_n: int = DEFAULT_TOP_N,
) -> list[str]:
    """
    Filter a pre-computed popularity table for a specific user.
    Excludes: already-read blogs + user's own blogs.
    """
    read_blogs = get_user_read_blogs(user_id, sessions, bookmarks, comments)
    owned_blogs = get_user_owned_blogs(user_id, blogs)
    exclude = read_blogs | owned_blogs

    candidates = popularity[~popularity["blog_id"].isin(exclude)]
    return candidates.head(top_n)["blog_id"].tolist()


def recommend_popular(
    user_id: str,
    blogs: pd.DataFrame,
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
    top_n: int = DEFAULT_TOP_N,
    half_life_days: float = DEFAULT_HALF_LIFE_DAYS,
    prior_strength: int = DEFAULT_PRIOR_STRENGTH,
    now: pd.Timestamp | None = None,
) -> list[str]:
    """
    Convenience function: compute popularity + filter in one call.
    For batch jobs, prefer compute_popularity_scores() once, then
    filter_recommendations() per user.
    """
    popularity = compute_popularity_scores(
        blogs=blogs,
        sessions=sessions,
        bookmarks=bookmarks,
        comments=comments,
        half_life_days=half_life_days,
        prior_strength=prior_strength,
        now=now,
    )
    return filter_recommendations(
        popularity=popularity,
        user_id=user_id,
        blogs=blogs,
        sessions=sessions,
        bookmarks=bookmarks,
        comments=comments,
        top_n=top_n,
    )


# ─── Edge: Load once, wire it together ───

def load_all():
    """Load all tables needed for popularity — call ONCE at the edge."""
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


def run_popularity_job(user_id: str | None = None, top_n: int = DEFAULT_TOP_N):
    """
    Entry point for a batch job / script / API handler.
    Loads data ONCE, then calls pure functions.
    """
    data = load_all()

    # Compute once
    popularity = compute_popularity_scores(**data)

    if user_id:
        recs = filter_recommendations(popularity=popularity, user_id=user_id, **data, top_n=top_n)
        print(f"Top {top_n} for {user_id}: {recs}")
        return recs

    # No user -> just show global popularity
    print(f"Global popularity for {len(popularity)} blogs")
    print(popularity.head(top_n)[["blog_id", "popularity_score", "n_interactions", "time_decay"]])
    return popularity


if __name__ == "__main__":
    import sys
    test_user = sys.argv[1] if len(sys.argv) > 1 else None
    run_popularity_job(test_user, top_n=10)