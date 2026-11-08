# Ranker
# LightGBM LambdaRank over the pair features from features/build.py.
#
# Idea: the earlier models are good GENERATORS, not good ORDERERS. They know
# "this user might like these 30 blogs" — they don't blend taste + popularity
# + social proof + freshness into one calibrated number. The ranker consumes
# all of that as features and learns the final ordering from what actually
# happened next.
#
# Training setup, leakage-safe:
#   1. Split interactions by TIME (evaluate.py's split).
#   2. Candidates per user: top hybrid picks from TRAIN data + all future
#      positives (a hit the generator missed must still be learnable).
#   3. Features from TRAIN data only; label from the FUTURE only.
#   4. LightGBM ranks, we evaluate with the same Recall@K.

import numpy as np
import pandas as pd

from recommender.features.build import FEATURE_COLUMNS, build_pair_features
from recommender.models.als import score_interactions
from recommender.models.content import build_content_model
from recommender.models.hybrid import rank_user_candidates
from recommender.models.popularity import compute_popularity_scores


DEFAULT_TOP_N = 10
DEFAULT_CANDIDATES_PER_USER = 30
DEFAULT_LABEL_THRESHOLD = 0.2  # mirrors evaluate.DEFAULT_RELEVANCE_THRESHOLD

RANKER_PARAMS = {
    "objective": "lambdarank",
    "metric": "ndcg",
    "ndcg_eval_at": [10],
    "learning_rate": 0.08,
    "num_leaves": 15,
    "min_data_in_leaf": 5,   # small-data-safe
    "label_gain": [0, 1],    # binary relevance: page-views of the label space
    "verbosity": -1,
}


# ─── Dataset construction ───

def build_training_candidates(
    blogs: pd.DataFrame,
    future_interactions: pd.DataFrame,
    *,
    popularity: pd.DataFrame | None,
    content_model,
    sessions: pd.DataFrame,
    bookmarks: pd.DataFrame,
    comments: pd.DataFrame,
    now: pd.Timestamp,
    top_n: int = DEFAULT_TOP_N,
    n_candidates: int = DEFAULT_CANDIDATES_PER_USER,
) -> pd.DataFrame:
    """
    For every user who hit something in the future, gather the training
    candidate pool: the hybrid generator's top picks + the future positives
    themselves. Every (user, blog) appears at most once.
    """
    if future_interactions.empty:
        return pd.DataFrame(columns=["user_id", "blog_id"])

    collected = []
    for user_id, group in future_interactions.groupby("user_id"):
        picked: set[str] = set(group["blog_id"])
        ranked = rank_user_candidates(
            user_id, blogs, popularity, content_model,
            sessions=sessions, bookmarks=bookmarks, comments=comments,
            top_n=n_candidates,
        )
        picked |= set(ranked["blog_id"])
        collected.extend({"user_id": user_id, "blog_id": b} for b in picked)

    return pd.DataFrame(collected).drop_duplicates(
        subset=["user_id", "blog_id"]
    ).reset_index(drop=True)


def build_labels(pairs: pd.DataFrame, future_interactions: pd.DataFrame,
                 threshold: float = DEFAULT_LABEL_THRESHOLD) -> pd.Series:
    """1 where the user interacted strongly with the blog in the future."""
    liked = future_interactions.loc[future_interactions["interest"] >= threshold]
    hit_pairs = set(zip(liked["user_id"], liked["blog_id"]))
    return pd.Series(
        [1 if (u, b) in hit_pairs else 0 for u, b in zip(pairs["user_id"], pairs["blog_id"])],
        index=pairs.index,
        name="label",
    )


def build_training_set(
    blogs: pd.DataFrame,
    train_sessions: pd.DataFrame,
    train_bookmarks: pd.DataFrame,
    train_comments: pd.DataFrame,
    test_sessions: pd.DataFrame,
    test_bookmarks: pd.DataFrame,
    test_comments: pd.DataFrame,
    *,
    now: pd.Timestamp,
    n_candidates: int = DEFAULT_CANDIDATES_PER_USER,
    threshold: float = DEFAULT_LABEL_THRESHOLD,
    with_als: bool = True,
) -> dict:
    """
    End-to-end dataset builder. TRAIN tables → features; TEST tables → labels.
    Returns {"features": DataFrame[FEATURE_COLUMNS], "labels": Series,
             "groups": list[int], "users": list[str]}.
    """
    train_inter = score_interactions(
        train_sessions, train_bookmarks, train_comments, now=now
    )
    future_inter = score_interactions(
        test_sessions, test_bookmarks, test_comments, now=now
    )

    popularity = compute_popularity_scores(
        blogs=blogs, sessions=train_sessions, bookmarks=train_bookmarks,
        comments=train_comments, now=now,
    )
    content_model = build_content_model(
        blogs, train_sessions, train_bookmarks, train_comments, now=now
    )

    als_model = None
    if with_als:
        from recommender.models.als import fit as fit_als
        als_model = fit_als(
            blogs, train_sessions, train_bookmarks, train_comments,
            now=now,
        )

    candidate = build_training_candidates(
        blogs, future_inter, popularity=popularity, content_model=content_model,
        sessions=train_sessions, bookmarks=train_bookmarks, comments=train_comments,
        now=now, n_candidates=n_candidates,
    )
    features = build_pair_features(
        candidate, blogs, train_inter, now,
        content_model=content_model, als_model=als_model,
    )
    labels = build_labels(features, future_inter, threshold)

    groups = features.groupby("user_id", sort=False).size().tolist()
    users = features["user_id"].drop_duplicates().tolist()

    return {
        "features": features,
        "labels": labels,
        "groups": groups,
        "users": users,
    }


# ─── Model: train / score / persist ───

def train(features: pd.DataFrame,
          labels: pd.Series,
          groups: list[int],
          params: dict | None = None,
          num_boost_round: int = 120):
    """LightGBM lambdarank. Groups must sum to len(features) IN ORDER."""
    import lightgbm as lgb

    if sum(groups) != len(features):
        raise ValueError(
            f"groups ({sum(groups)}) must sum to the number of rows ({len(features)})"
        )

    final_params = {**RANKER_PARAMS, **(params or {})}
    dataset = lgb.Dataset(
        features[FEATURE_COLUMNS].to_numpy(dtype=np.float64),
        label=labels.to_numpy(dtype=np.int32),
        group=groups,
        feature_name=FEATURE_COLUMNS,
        free_raw_data=False,
    )
    return lgb.train(
        final_params, dataset, num_boost_round=num_boost_round,
        valid_sets=[dataset], callbacks=[lgb.log_evaluation(0)],
    )


def score(booster, features: pd.DataFrame) -> np.ndarray:
    """Rank scores for a feature frame — same column order as training."""
    return booster.predict(features[FEATURE_COLUMNS].to_numpy(dtype=np.float64))


def sort_by_score(features: pd.DataFrame, preds: np.ndarray,
                  top_n: int = DEFAULT_TOP_N) -> pd.DataFrame:
    """Attach predictions and return the frame ordered best-first, top_n rows."""
    out = features.copy()
    out["rank_score"] = preds
    return out.sort_values("rank_score", ascending=False).head(top_n).reset_index(drop=True)


def save(booster, path: str) -> str:
    booster.save_model(path)
    return path


def load(path: str):
    import lightgbm as lgb
    return lgb.Booster(model_file=path)


# ─── The recommend_fn glue for evaluate() ───

class RankerRecommender:
    """
    Fits EVERYTHING on train data once, then answers per-user queries:
    hybrid candidates → LightGBM ordering. The recommend_fn(user_id, train)
    interface evaluate() expects.
    """

    def __init__(
        self,
        *,
        n_candidates: int = DEFAULT_CANDIDATES_PER_USER,
        with_als: bool = True,
        num_boost_round: int = 120,
        params: dict | None = None,
    ):
        self.n_candidates = n_candidates
        self.with_als = with_als
        self.num_boost_round = num_boost_round
        self.params = params
        self.booster = None

    def fit(self, blogs, sessions, bookmarks, comments, *, now: pd.Timestamp):
        popularity = compute_popularity_scores(
            blogs=blogs, sessions=sessions, bookmarks=bookmarks,
            comments=comments, now=now,
        )
        content_model = build_content_model(
            blogs, sessions, bookmarks, comments, now=now
        )
        self.popularity = popularity
        self.content_model = content_model
        self.blogs = blogs
        self.sessions = sessions
        self.bookmarks = bookmarks
        self.comments = comments
        self.now = now

        if self.with_als:
            from recommender.models.als import fit as fit_als
            self.als_model = fit_als(
                blogs, sessions, bookmarks, comments, now=now,
            )
        else:
            self.als_model = None
        return self

    def build_candidates(self, user_id: str, n_candidates: int | None = None) -> pd.DataFrame:
        from recommender.models.content import exclusions_for_user
        exclude = exclusions_for_user(
            user_id, self.blogs, self.sessions, self.bookmarks, self.comments
        )
        eligible = self.blogs[~self.blogs["blog_id"].isin(exclude)]
        if eligible.empty:
            return pd.DataFrame(columns=["user_id", "blog_id"])
        # the pool: what the cheap models think is promising
        ranked = rank_user_candidates(
            user_id, self.blogs, self.popularity, self.content_model,
            sessions=self.sessions, bookmarks=self.bookmarks, comments=self.comments,
            top_n=n_candidates or self.n_candidates,
        )
        return pd.DataFrame({
            "user_id": [user_id] * len(ranked),
            "blog_id": ranked["blog_id"].tolist(),
        })

    def feature_rows(self, candidates: pd.DataFrame) -> pd.DataFrame:
        train_inter = score_interactions(
            self.sessions, self.bookmarks, self.comments, now=self.now
        )
        return build_pair_features(
            candidates, self.blogs, train_inter, self.now,
            content_model=self.content_model, als_model=self.als_model,
        )

    def gen_ranker_labels_and_train(self, future_interactions: pd.DataFrame,
                                    threshold: float = DEFAULT_LABEL_THRESHOLD):
        """Build a training set from self's TRAIN state + a future table."""
        train_inter = score_interactions(
            self.sessions, self.bookmarks, self.comments, now=self.now
        )
        candidate = build_training_candidates(
            self.blogs, future_interactions,
            popularity=self.popularity, content_model=self.content_model,
            sessions=self.sessions, bookmarks=self.bookmarks, comments=self.comments,
            now=self.now, n_candidates=self.n_candidates,
        )
        features = self.feature_rows(candidate)
        labels = build_labels(features, future_interactions, threshold)
        groups = features.groupby("user_id", sort=False).size().tolist()
        if 1 <= min(groups, default=0):
            self.booster = train(
                features, labels, groups,
                params=self.params, num_boost_round=self.num_boost_round,
            )
        return features, labels

    def recommend(self, user_id: str, top_n: int = DEFAULT_TOP_N) -> list[str]:
        """Rank this user's candidates with the fitted booster."""
        candidates = self.build_candidates(user_id)
        if candidates.empty:
            return []
        if self.booster is None:
            # no booster trained → the hybrid ordering is the honest fallback
            ranked = rank_user_candidates(
                user_id, self.blogs, self.popularity, self.content_model,
                sessions=self.sessions, bookmarks=self.bookmarks, comments=self.comments,
                top_n=top_n,
            )
            return ranked["blog_id"].tolist()
        features = self.feature_rows(candidates)
        preds = score(self.booster, features)
        return sort_by_score(features, preds, top_n)["blog_id"].tolist()

    def as_recommend_fn(self, top_n: int = DEFAULT_TOP_N):
        def fn(user_id: str, train: dict) -> list[str]:
            return self.recommend(user_id, top_n)
        return fn
