# Content
# Learn what genres each person actually enjoys and rank un-read blogs by taste.
# Popularity asks "what do people like?"; content asks "what does THIS user like?"
#
# The pipeline:
#   1. interactions (user, blog) get an interest score (features/interest.py)
#   2. expand every interaction into (user, genre) rows — a blog with 2 genres
#      credits both
#   3. per-user genre affinity = shrunk mean interest of that genre
#      affinity = sum(interest) / (n_reads + prior_strength)
#      With prior_strength=3: one great read on a genre gives ~0.9*12/(1+3)*… —
#      high but capped; genres the user has *bounced* on go toward 0/negative.
#   4. score a candidate blog = mean affinity across its genres, with genres
#      the user never touched defaulting to the genre's global mean (shrunk),
#      never to 0 — so a new-ish genre is "unknown", not "disliked".
#
# Cold users (no history): fall back to popularity for the same feed.

from dataclasses import dataclass

import pandas as pd

from recommender.features.interest import build_interactions, interest_score
from recommender.models.popularity import (
    get_user_owned_blogs,
    get_user_read_blogs,
    recommend_popular,
)


DEFAULT_PRIOR_STRENGTH = 3.0
DEFAULT_MIN_HISTORY = 1  # reads needed before we trust taste over popularity
DEFAULT_TOP_N = 10


# ─── Middle: scoring primitives (no DB access) ───

def score_interactions(
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
    now: pd.Timestamp,
    half_life_days: float = 30,
) -> pd.DataFrame:
    """One row per (user, blog) with the interest score attached."""
    interactions = build_interactions(sessions, bookmarks, comments)
    if interactions.empty:
        return interactions
    interactions["interest"] = interest_score(interactions, now, half_life_days)
    return interactions


def build_genre_affinity(
    interactions: pd.DataFrame,
    blogs: pd.DataFrame,
    prior_strength: float = DEFAULT_PRIOR_STRENGTH,
) -> pd.DataFrame:
    """
    Per-user genre taste table: [user_id, genre, affinity].

    `affinity` is the shrunk mean interest this user shows for the genre:
        sum(interest over reads touching the genre) / (n_reads + prior_strength)
    Blogs with several genres count for each one (a 'Fiction+Travel' post
    they loved says something about both).

    Works on the SCORED interactions from score_interactions().
    """
    if interactions.empty or blogs.empty:
        return pd.DataFrame(columns=["user_id", "genre", "n_reads", "sum_interest", "affinity"])

    exploded = blogs[["blog_id", "genres"]].explode("genres").rename(
        columns={"genres": "genre"}
    ).dropna(subset=["genre"])

    tagged = interactions[["user_id", "blog_id", "interest"]].merge(
        exploded, on="blog_id", how="inner"
    )
    if tagged.empty:
        return pd.DataFrame(columns=["user_id", "genre", "n_reads", "sum_interest", "affinity"])

    grouped = tagged.groupby(["user_id", "genre"], as_index=False).agg(
        n_reads=("interest", "size"),
        sum_interest=("interest", "sum"),
    )
    grouped["affinity"] = grouped["sum_interest"] / (
        grouped["n_reads"] + prior_strength
    )
    return grouped


def build_genre_defaults(
    interactions: pd.DataFrame,
    blogs: pd.DataFrame,
    prior_strength: float = DEFAULT_PRIOR_STRENGTH,
) -> dict[str, float]:
    """
    Global fallback affinity per genre — the shrunk mean interest across ALL
    users. A genre nobody has read lands at 0 (neutral, not disliked).
    """
    if interactions.empty or blogs.empty:
        return {}
    affinity = build_genre_affinity(interactions, blogs, prior_strength)
    grouped = affinity.groupby("genre", as_index=False).agg(
        n_reads=("n_reads", "sum"), sum_interest=("sum_interest", "sum")
    )
    grouped["affinity"] = grouped["sum_interest"] / (grouped["n_reads"] + prior_strength)
    return dict(zip(grouped["genre"], grouped["affinity"].astype(float)))


@dataclass
class ContentModel:
    """Everything needed to score any (user, blog) pair from history alone."""

    blogs: pd.DataFrame
    profiles: pd.DataFrame          # [user_id, genre, affinity] as built above
    defaults: dict[str, float]      # genre -> global shrunk affinity

    def user_tastes(self, user_id: str) -> dict[str, float]:
        """{genre: affinity} for one user; {} if they have no history."""
        rows = self.profiles[self.profiles["user_id"] == user_id]
        return dict(zip(rows["genre"], rows["affinity"].astype(float)))

    def score_blog(self, user_id: str, genres: list[str]) -> float:
        """Mean affinity over the blog's genres. Never-read genres use defaults."""
        tastes = self.user_tastes(user_id)
        values = [tastes.get(g, self.defaults.get(g, 0.0)) for g in genres]
        return sum(values) / len(values) if values else 0.0

    def rank_blogs(
        self,
        user_id: str,
        exclude: set[str] | None = None,
    ) -> pd.DataFrame:
        """
        Rank EVERY published blog for one user as [blog_id, content_score],
        best first. Exclusions are applied here so the caller gets a
        recommendation-ready list.
        """
        exclude = exclude or set()
        rows = [
            (b.blog_id, self.score_blog(user_id, b.genres))
            for b in self.blogs.itertuples(index=False)
            if b.blog_id not in exclude
        ]
        if not rows:
            return pd.DataFrame(columns=["blog_id", "content_score"])
        ranked = pd.DataFrame(rows, columns=["blog_id", "content_score"])
        return ranked.sort_values("content_score", ascending=False).reset_index(drop=True)


def build_content_model(
    blogs: pd.DataFrame,
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
    *,
    now: pd.Timestamp,
    half_life_days: float = 30,
    prior_strength: float = DEFAULT_PRIOR_STRENGTH,
) -> ContentModel:
    """Fit everything the content model needs in one pass."""
    interactions = score_interactions(
        sessions, bookmarks, comments, now=now, half_life_days=half_life_days
    )
    return ContentModel(
        blogs=blogs,
        profiles=build_genre_affinity(interactions, blogs, prior_strength),
        defaults=build_genre_defaults(interactions, blogs, prior_strength),
    )


def exclusions_for_user(
    user_id: str,
    blogs: pd.DataFrame,
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
) -> set[str]:
    """Read blogs + own blogs — the same filter popularity applies."""
    return get_user_read_blogs(user_id, sessions, bookmarks, comments) | \
        get_user_owned_blogs(user_id, blogs)


def history_size(user_id: str, sessions: pd.DataFrame) -> int:
    """Distinct blogs this user read. Thin history → don't trust taste yet."""
    if sessions.empty:
        return 0
    return sessions.loc[sessions["user_id"] == user_id, "blog_id"].nunique()


def make_content_model_fn(
    model: ContentModel,
    blogs: pd.DataFrame,
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
    *,
    top_n: int = DEFAULT_TOP_N,
    min_history: int = DEFAULT_MIN_HISTORY,
    fallback_fn=None,
):
    """
    Turn a fitted ContentModel into the recommend_fn(user_id, train) shape
    the evaluator expects. Users below `min_history` reads get
    `fallback_fn` (popularity) instead — with no evidence, taste scores are
    all defaults and the list would be a worse version of popularity anyway.
    """
    if fallback_fn is None:
        fallback_fn = lambda uid, data: recommend_popular(uid, **data, top_n=top_n)  # noqa: E731

    def fn(user_id: str, train: dict) -> list[str]:
        data = {
            "blogs": train["blogs"],
            "sessions": train["sessions"],
            "bookmarks": train["bookmarks"],
            "comments": train["comments"],
        }
        if history_size(user_id, data["sessions"]) < min_history:
            return fallback_fn(user_id, data)

        exclude = exclusions_for_user(user_id, **data)
        ranked = model.rank_blogs(user_id, exclude=exclude)
        return ranked.head(top_n)["blog_id"].tolist()

    return fn


def recommend_content(
    user_id: str,
    blogs: pd.DataFrame,
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
    *,
    top_n: int = DEFAULT_TOP_N,
    prior_strength: float = DEFAULT_PRIOR_STRENGTH,
    now: pd.Timestamp | None = None,
) -> list[str]:
    """
    Convenience one-shot: fit a ContentModel and rank for one user.
    Batch jobs should call build_content_model() once, then make_content_model_fn().
    """
    if now is None:
        now = pd.Timestamp.now(tz="UTC")
    model = build_content_model(
        blogs, sessions, bookmarks, comments,
        now=now, prior_strength=prior_strength,
    )
    fn = make_content_model_fn(
        model, blogs, sessions, bookmarks, comments, top_n=top_n
    )
    return fn(user_id, {
        "blogs": blogs, "sessions": sessions,
        "bookmarks": bookmarks, "comments": comments,
    })


# ─── Edge: load once, wire it together ───

def load_all():
    """Load everything the content model needs — call ONCE at the edge."""
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


def run_content_job(user_id: str, top_n: int = DEFAULT_TOP_N):
    """Entry point for a batch job / script. Loads data ONCE, ranks for one user."""
    data = load_all()
    model = build_content_model(data["blogs"], data["sessions"],
                                data["bookmarks"], data["comments"],
                                now=pd.Timestamp.now(tz="UTC"))
    fn = make_content_model_fn(
        model, data["blogs"], data["sessions"], data["bookmarks"], data["comments"],
        top_n=top_n,
    )
    recs = fn(user_id, data)
    print(f"Top {top_n} for {user_id} (content): {recs}")
    return recs


if __name__ == "__main__":
    import sys
    run_content_job(sys.argv[1] if len(sys.argv) > 1 else "")
