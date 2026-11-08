# Feature building
# Turns raw tables into one feature vector per (user, blog) candidate pair —
# the input the LightGBM ranker trains on and scores with.
#
# Three layers, mixed into a single row per pair (house rule: leak nothing —
# every feature comes from TRAIN-side data only; labels are built elsewhere):
#
#   user features  — what kind of reader is this? (volume, engagement, recency)
#   item features  — what kind of blog is this?  (popularity, engagement, age)
#   cross features — the interesting part: does THIS user match THIS blog?
#                    taste score, ALS score, author affinity, genre coverage
#
# Row contract for the ranker: FEATURE_COLUMNS, in this exact order, everyday,
# on both the training and the inference side.

import numpy as np
import pandas as pd


CROSS_FEATURES = [
    "content_score",        # genre-affinity mean (models/content.py)
    "content_n_known",      # share of the blog's genres the user has evidence on
    "genre_affinity_max",   # best-matching single genre
    "als_score",            # embedding dot product (models/als.py)
    "author_reads",         # how many of this user's reads are from this author
    "author_share",         # ... as a share of their total reads
]

USER_FEATURES = [
    "user_reads",           # distinct blogs read
    "user_mean_interest",   # how much they generally enjoy what they open
    "user_completion_rate", # share of reads finished
    "user_recency_days",    # days since their last interaction
]

ITEM_FEATURES = [
    "item_reads",           # interactions per blog
    "item_mean_interest",   # how much people like it (shrunk toward global)
    "item_completed_rate",
    "item_age_days",        # publication age — put in cross? item-side is fine
]

FEATURE_COLUMNS = CROSS_FEATURES + USER_FEATURES + ITEM_FEATURES

DEFAULT_PRIOR_STRENGTH = 5.0


# ─── User features ───

def build_user_features(scored_interactions: pd.DataFrame, now: pd.Timestamp) -> pd.DataFrame:
    """One row per user with their reading profile."""
    if scored_interactions.empty:
        return pd.DataFrame(columns=["user_id"] + USER_FEATURES)
    grouped = scored_interactions.groupby("user_id").agg(
        user_reads=("blog_id", "nunique"),
        user_mean_interest=("interest", "mean"),
        user_completion_rate=("completed", "mean"),
        user_last_at=("last_at", "max"),
    ).reset_index()
    grouped["user_recency_days"] = (
        (now - grouped["user_last_at"]).dt.total_seconds() / 86400
    )
    return grouped[["user_id"] + USER_FEATURES]


# ─── Item features ───

def build_item_features(
    blogs: pd.DataFrame,
    scored_interactions: pd.DataFrame,
    now: pd.Timestamp,
    prior_strength: float = DEFAULT_PRIOR_STRENGTH,
) -> pd.DataFrame:
    """
    One row per blog with its engagement profile. mean_interest is shrunk
    toward 0 with a pseudo-count so one lucky read doesn't make a blog look
    great (same Bayesian idea as the popularity model).
    """
    stats = blogs[["blog_id", "user_id", "published_at"]].copy()
    stats["published_at"] = pd.to_datetime(stats["published_at"], utc=True, errors="coerce")

    if not scored_interactions.empty:
        per_blog = scored_interactions.groupby("blog_id").agg(
            item_reads=("interest", "size"),
            interest_sum=("interest", "sum"),
            item_completed_rate=("completed", "mean"),
        ).reset_index()
        stats = stats.merge(per_blog, on="blog_id", how="left")
    else:
        stats["item_reads"] = np.nan
        stats["interest_sum"] = np.nan
        stats["item_completed_rate"] = np.nan

    stats["item_reads"] = stats["item_reads"].fillna(0).astype(int)
    stats["interest_sum"] = stats["interest_sum"].fillna(0.0)
    stats["item_mean_interest"] = stats["interest_sum"] / (stats["item_reads"] + prior_strength)
    stats["item_completed_rate"] = stats["item_completed_rate"].fillna(0.0)
    stats["item_age_days"] = (
        (now - stats["published_at"]).dt.total_seconds() / 86400
    )
    return stats[["blog_id", "user_id", "published_at"] + ITEM_FEATURES].rename(
        columns={"user_id": "author_id"}
    )


# ─── Cross features for one (user, blog) pair-set ───

def _author_lookup(item_features: pd.DataFrame) -> pd.Series:
    return dict(zip(item_features["blog_id"], item_features["author_id"]))


def _author_reads(
    scored_interactions: pd.DataFrame,
    author_of: dict[str, str],
    user_id: str,
) -> pd.Series:
    """Per blog: how many of this user's read blogs were by the blog's author."""
    user_reads = scored_interactions.loc[
        scored_interactions["user_id"] == user_id, "blog_id"
    ]
    read_set = set(user_reads)
    if not read_set:
        return pd.Series(dtype=float)
    # For a candidate by author X: favorite count across user's read blogs by X
    reads = user_reads.value_counts()
    authors = {author_of.get(b): n for b, n in reads.items() if author_of.get(b)}
    return pd.Series(authors)


def build_pair_features(
    pairs: pd.DataFrame,
    blogs: pd.DataFrame,
    scored_interactions: pd.DataFrame,
    now: pd.Timestamp,
    content_model=None,
    als_model=None,
    prior_strength: float = DEFAULT_PRIOR_STRENGTH,
) -> pd.DataFrame:
    """
    The final feature table: one row per (user_id, blog_id) pair in `pairs`,
    FEATURE_COLUMNS in order, indexed by (user_id, blog_id).

    content_model: fitted ContentModel (models/content.py) → taste features
    als_model: fitted ALSModel (models/als.py) → embedding score feature
    """
    if pairs.empty:
        return pd.DataFrame(columns=["user_id", "blog_id"] + FEATURE_COLUMNS)

    user_features = build_user_features(scored_interactions, now)
    item_features = build_item_features(blogs, scored_interactions, now, prior_strength)
    author_of = _author_lookup(item_features)

    out = pairs.copy()

    # Merge the side tables on their keys
    out = out.merge(item_features, on="blog_id", how="left")
    out = out.merge(user_features, on="user_id", how="left")

    # Cross: content (taste) features
    genre_of = dict(zip(blogs["blog_id"],
                        blogs["genres"].map(lambda v: v if isinstance(v, list) else [])))
    if content_model is not None:
        tastes_cache: dict[str, dict[str, float]] = {}

        def _tastes(u: str) -> dict[str, float]:
            if u not in tastes_cache:
                tastes_cache[u] = content_model.user_tastes(u)
            return tastes_cache[u]

        taste, known, best = [], [], []
        for r in pairs.itertuples(index=False):
            genres = genre_of.get(r.blog_id, [])
            tastes = _tastes(r.user_id)
            taste.append(content_model.score_blog(r.user_id, genres))
            known.append(sum(1 for g in genres if g in tastes) / len(genres)
                         if genres else 0.0)
            present = [tastes[g] for g in genres if g in tastes]
            best.append(max(present) if present else 0.0)
        out["content_score"] = taste
        out["content_n_known"] = known
        out["genre_affinity_max"] = best
    else:
        out["content_score"] = 0.0
        out["content_n_known"] = 0.0
        out["genre_affinity_max"] = 0.0

    # Cross: embedding score
    if als_model is not None:
        scores = []
        for r in pairs.itertuples(index=False):
            scores.append(als_model.score_pairs(r.user_id, [r.blog_id])[r.blog_id])
        out["als_score"] = scores
    else:
        out["als_score"] = 0.0

    # Cross: author affinity — reads per author are user-specific, compute once
    author_reads_cache: dict[str, pd.Series] = {}

    def _author_reads_for(u: str) -> pd.Series:
        if u not in author_reads_cache:
            author_reads_cache[u] = _author_reads(scored_interactions, author_of, u)
        return author_reads_cache[u]

    n_author_reads, share = [], []
    for r in out.itertuples(index=False):
        per_author = _author_reads_for(r.user_id)
        author = author_of.get(r.blog_id)
        n = int(per_author.get(author, 0)) if author is not None else 0
        n_author_reads.append(n)
        total = r.user_reads if pd.notna(r.user_reads) else 0.0
        share.append(n / total if total > 0 else 0.0)
    out["author_reads"] = n_author_reads
    out["author_share"] = share

    # NaN hygiene — every feature must be a finite float
    for col in FEATURE_COLUMNS:
        out[col] = pd.to_numeric(out[col], errors="coerce")
        out[col] = out[col].fillna(0.0).astype(float)

    return out[["user_id", "blog_id"] + FEATURE_COLUMNS].reset_index(drop=True)
