# Evaluation
# Answers one question: "Is this recommender actually any good?"
#
# We can't test a recommender on today's data So we fake a future:
#   1. Pick a cutoff date. Rows before it = the "past" (train), rows at or
#      after it = the "future" (test).
#   2. Give the model only the past, ask for top-K recommendations.
#   3. Take the blogs the user turned out to really like in the future
#      (interest score above a threshold) and check how many showed up
#      in the top K. That fraction is Recall@K.
#
# This is a train/test split by TIME, not by random rows. In real life the
# model never sees tomorrow's data, so a temporal split is the honest test.
#
# The three leakage traps this module deliberately avoids:
#   1. The recommender only ever receives train tables.
#   2. Scoring uses now=cutoff, not the real current time — otherwise the
#      time decay is computed against a date later than everything the
#      model was allowed to know.
#   3. Only blogs published before the cutoff can be recommended. A blog
#      that didn't exist yet can't be a hit, and can't be returned either.
#
# Usage: evaluate(recommend_fn, ...) where recommend_fn(user_id, train)
# returns a ranked list of blog_ids, built ONLY from train:
#   train = {"blogs": …, "sessions": …, "bookmarks": …, "comments": …}

import pandas as pd

from recommender.features.interest import build_interactions, interest_score
from recommender.models.popularity import recommend_popular


DEFAULT_RELEVANCE_THRESHOLD = 0.2
DEFAULT_TOP_K = 10
DEFAULT_HISTORY_FRACTION = 0.8


# ─── Step 1: split the timeline into past and future ───

def _utc_column(df: pd.DataFrame, column: str) -> pd.Series:
    """One timestamp column as UTC datetime; empty series if missing (empty table)."""
    if df.empty or column not in df.columns:
        return pd.Series(dtype="datetime64[ns, UTC]")
    return pd.to_datetime(df[column], utc=True, errors="coerce")


def _event_timestamps(sessions, bookmarks, comments) -> pd.Series:
    """Collect every interaction timestamp as one UTC series.

    started_at for sessions (when the user opened the blog), created_at
    for bookmarks and comments (their only timestamps).
    """
    parts = [
        _utc_column(sessions, "started_at"),
        _utc_column(bookmarks, "created_at"),
        _utc_column(comments, "created_at"),
    ]
    return pd.concat(parts, ignore_index=True).dropna()


def suggest_cutoff(sessions, bookmarks, comments,
                   fraction: float = DEFAULT_HISTORY_FRACTION) -> pd.Timestamp:
    """
    The timestamp that `fraction` of all interactions fall before.
    With the default 0.8: the oldest 80% of interactions become train,
    the newest 20% become test.
    """
    stamps = _event_timestamps(sessions, bookmarks, comments)
    if stamps.empty:
        raise ValueError("No interactions at all — cannot pick a cutoff.")
    quantile = stamps.quantile(fraction)
    return pd.Timestamp(quantile).tz_convert("UTC")


def split_by_time(
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
    cutoff: pd.Timestamp,
) -> dict:
    """
    Split the three interaction tables by time.

    Rows strictly BEFORE the cutoff are the past (train — the model may see
    these); rows AT OR AFTER the cutoff are the future (test — the answers).
    Returns {"train": {…}, "test": {…}} with the same table names.
    """
    cutoff = pd.Timestamp(cutoff, tz="UTC") if pd.Timestamp(cutoff).tzinfo is None \
        else pd.Timestamp(cutoff)

    started = _utc_column(sessions, "started_at")
    bookmarked = _utc_column(bookmarks, "created_at")
    commented = _utc_column(comments, "created_at")

    def split(df: pd.DataFrame, stamps: pd.Series) -> tuple[pd.DataFrame, pd.DataFrame]:
        if df.empty:
            return df, df
        mask = stamps < cutoff
        return df[mask.fillna(False)], df[(~mask).fillna(False)]

    train_sessions, test_sessions = split(sessions, started)
    train_bookmarks, test_bookmarks = split(bookmarks, bookmarked)
    train_comments, test_comments = split(comments, commented)

    return {
        "train": {
            "sessions": train_sessions,
            "bookmarks": train_bookmarks,
            "comments": train_comments,
        },
        "test": {
            "sessions": test_sessions,
            "bookmarks": test_bookmarks,
            "comments": test_comments,
        },
    }


def filter_blogs_by_cutoff(blogs: pd.DataFrame, cutoff: pd.Timestamp) -> pd.DataFrame:
    """
    Keep only blogs that existed before the cutoff.
    Fedora the recommender these blogs, and it cannot recommend a blog
    that didn't exist yet. Also used to clean garbage recommendations
    (trap 3) before scoring.
    """
    cutoff = pd.Timestamp(cutoff)
    published = pd.to_datetime(blogs["published_at"], utc=True, errors="coerce")
    return blogs[published.notna() & (published <= cutoff)]


# ─── Step 2: which blogs count as "should have been recommended" ───

def build_relevant(
    test_sessions: pd.DataFrame,
    test_bookmarks: pd.DataFrame,
    test_comments: pd.DataFrame,
    threshold: float = DEFAULT_RELEVANCE_THRESHOLD,
    now: pd.Timestamp | None = None,
) -> dict[str, set[str]]:
    """
    For every (user, blog) pair that happened in the future, score how much
    the user actually liked it, and keep the pairs above `threshold`.

    The threshold exists so a bounce (opened, <15s, barely scrolled) is not
    treated as "the model should have recommended this". The clocks inside
    interest_score are judged against `now`; we pass the evaluation cutoff
    so BOTH sides of the comparison (recommender inputs and labels) are
    scored on the same timeline.
    """
    if now is None:
        now = pd.Timestamp.now(tz="UTC")

    interactions = build_interactions(test_sessions, test_bookmarks, test_comments)
    if interactions.empty:
        return {}

    interactions["interest"] = interest_score(interactions, now)
    liked = interactions[interactions["interest"] >= threshold]

    return {
        user_id: set(group["blog_id"])
        for user_id, group in liked.groupby("user_id")
    }


# ─── Step 3: the score for one user ───

def recall_at_k(recommended: list[str], relevant: set[str], k: int = DEFAULT_TOP_K) -> float:
    """
    Of the blogs the user liked in the future, what fraction appeared in
    the top K of our list?

    User liked {P, Q}; we recommended 10 blogs including P but not Q:
    Recall@10 = 1/2 = 0.5
    """
    if not relevant:
        return 0.0
    top_k = set(recommended[:k])
    return len(top_k & relevant) / len(relevant)


# ─── Step 4: the loop over all users ───

def evaluate(
    recommend_fn,
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
    blogs: pd.DataFrame,
    cutoff: pd.Timestamp,
    top_k: int = DEFAULT_TOP_K,
    relevance_threshold: float = DEFAULT_RELEVANCE_THRESHOLD,
) -> dict:
    """
    Put the whole fake-future experiment together.

    recommend_fn(user_id, train) -> ranked list of blog_ids (longest top_k).
    `train` carries ONLY pre-cutoff tables, and `train["blogs"]` is already
    restricted to blogs published before the cutoff — if the recommender
    builds candidates from train it physically cannot leak or time-travel.

    Returns {"recall_at_k", "n_users", "per_user", "cutoff", "top_k"} where
    per_user is the detail rows (user, recall, n_relevant, n_recs) so a
    bad score can be debugged without re-running everything.
    """
    cutoff = pd.Timestamp(cutoff)
    split = split_by_time(sessions, bookmarks, comments, cutoff)
    train = split["train"]
    test = split["test"]

    # Only pre-cutoff blogs may be recommended (trap 3).
    visible_blogs = filter_blogs_by_cutoff(blogs, cutoff)
    valid_blog_ids = set(visible_blogs["blog_id"])
    train = {**train, "blogs": visible_blogs}

    relevant_by_user = build_relevant(
        test["sessions"], test["bookmarks"], test["comments"],
        threshold=relevance_threshold, now=cutoff,
    )

    per_user = []
    for user_id, relevant in relevant_by_user.items():
        recommended = recommend_fn(user_id, train)

        # Stop the model from recommending something it never saw — a
        # returned blog id that isn't a pre-cutoff blog is a bug, not a hit.
        clean = [b for b in recommended if b in valid_blog_ids]
        n_dropped = len(recommended) - len(clean)
        if n_dropped:
            print(f"  ⚠ {user_id}: recommend_fn returned {n_dropped} blog(s) "
                  f"published after the cutoff — dropped before scoring.")

        per_user.append({
            "user_id": user_id,
            "recall": recall_at_k(clean, relevant, top_k),
            "n_relevant": len(relevant),
            "n_recs": len(clean),
        })

    if not per_user:
        return {
            "recall_at_k": 0.0,
            "n_users": 0,
            "per_user": [],
            "cutoff": cutoff,
            "top_k": top_k,
        }

    recalls = pd.Series([row["recall"] for row in per_user])
    return {
        "recall_at_k": float(recalls.mean()),
        "n_users": len(per_user),
        "per_user": per_user,
        "cutoff": cutoff,
        "top_k": top_k,
    }


# ─── Demo: model A vs model B on the synthetic world ───
# The synthetic dataset has a guaranteed genre signal in it. If popularity
# recovers ANY of it, recall should beat recall on shuffled labels (0 by
# construction here: labels are disjoint from the no-history fallback list,
# so the honest benchmark is recall reasonably above ~0 plus recall of a
# differently-tuned variant).

def _popularity_model(half_life_days: float, prior_strength: int, top_n: int, cutoff: pd.Timestamp):
    """Build a recommend_fn around recommend_popular, tuned one way."""
    def fn(user_id: str, train: dict) -> list[str]:
        return recommend_popular(
            user_id,
            blogs=train["blogs"],
            sessions=train["sessions"],
            bookmarks=train["bookmarks"],
            comments=train["comments"],
            top_n=top_n,
            half_life_days=half_life_days,
            prior_strength=prior_strength,
            now=cutoff,  # trap 2: score against the day the model lives on
        )
    return fn


def run_demo():
    from recommender.dev.synthetic import generate

    data = generate()
    cutoff = suggest_cutoff(
        data["sessions"], data["bookmarks"], data["comments"],
        fraction=DEFAULT_HISTORY_FRACTION,
    )
    print(f"Synthetic world: {len(data['users'])} users, {len(data['blogs'])} blogs")
    print(f"Cutoff (80% of interactions become the past): {cutoff.date()}")

    results = {}
    for name, model in [
        ("A: half-life 30d, prior 5", _popularity_model(30, 5, 10, cutoff)),
        ("B: half-life 90d, prior 10", _popularity_model(90, 10, 10, cutoff)),
    ]:
        results[name] = evaluate(
            model,
            sessions=data["sessions"],
            bookmarks=data["bookmarks"],
            comments=data["comments"],
            blogs=data["blogs"],
            cutoff=cutoff,
            top_k=10,
        )
        r = results[name]
        print(f"\n{name}: Recall@10 = {r['recall_at_k']:.4f} over {r['n_users']} users")

    best = max(results, key=lambda name: results[name]["recall_at_k"])
    print(f"\nBetter model: {best}")


if __name__ == "__main__":
    run_demo()
