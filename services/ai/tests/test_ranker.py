# tests/test_ranker.py
# The ranker needs lightgbm (installed); the tests keep the data tiny so
# training is fast and the behavior is checkable by hand.

import numpy as np
import pandas as pd
import pytest

lgb = pytest.importorskip("lightgbm")

from recommender.features.build import FEATURE_COLUMNS
from recommender.models.ranker import (
    RankerRecommender,
    build_labels,
    build_training_set,
    score,
    sort_by_score,
    train,
)

NOW = pd.Timestamp("2024-01-15", tz="UTC")

STALE_COLUMNS = ["id", "blog_id", "user_id", "parent_comment_id", "body",
                 "created_at", "updated_at"]


def _blogs():
    return pd.DataFrame({
        "blog_id": ["A", "B", "C", "D"],
        "user_id": ["u9", "u9", "u8", "u8"],
        "genres": [["Technology"], ["Technology"], ["Poetry"], ["Poetry"]],
        "published_at": ["2024-01-10"] * 4,
    })


def _sessions():
    """u1 reads only A hard (train side). u2 reads C."""
    return pd.DataFrame({
        "user_id": ["u1", "u2"],
        "blog_id": ["A", "C"],
        "session_id": ["s1", "s3"],
        "active_seconds": [600, 600],
        "max_scroll_percent": [100, 100],
        "completed": [True, True],
        "started_at": [NOW] * 2,
        "updated_at": [NOW] * 2,
    })


def _bookmarks():
    bm = pd.DataFrame(columns=["id", "user_id", "blog_id", "created_at"])
    return bm


def _comments():
    return pd.DataFrame(columns=STALE_COLUMNS)


def test_build_labels_marks_future_hits():
    pairs = pd.DataFrame({
        "user_id": ["u1", "u1", "u1"],
        "blog_id": ["A", "B", "C"],
    })
    future = pd.DataFrame({
        "user_id": ["u1", "u1"],
        "blog_id": ["A", "C"],
        "interest": [0.9, -0.1],   # only A clears the threshold
    })
    labels = build_labels(pairs, future, threshold=0.2)
    assert labels.tolist() == [1, 0, 0]


def test_train_and_score_works(tmp_path):
    features = pd.DataFrame(
        np.random.default_rng(0).normal(size=(8, len(FEATURE_COLUMNS))),
        columns=FEATURE_COLUMNS,
    )
    users = ["u1"] * 4 + ["u2"] * 4
    features.insert(0, "user_id", users)
    features.insert(1, "blog_id", [f"B{i}" for i in range(8)])
    labels = pd.Series([1, 0, 0, 0, 0, 1, 0, 0])
    groups = [4, 4]

    booster = train(features, labels, groups, num_boost_round=10)
    preds = score(booster, features)
    assert len(preds) == 8 and np.isfinite(preds).all()

    ordered = sort_by_score(features, preds, top_n=3)
    assert len(ordered) == 3
    assert ordered["rank_score"].is_monotonic_decreasing

    from recommender.models.ranker import save, load
    path = save(booster, str(tmp_path / "ranker.txt"))
    restored = load(path)
    assert np.allclose(score(restored, features), preds)


def test_build_training_set_is_grouped_and_labeled():
    result = build_training_set(
        _blogs(), _sessions(), _bookmarks(), _comments(),
        _sessions(), _bookmarks(), _comments(),  # future == train for the test
        now=NOW, n_candidates=5, with_als=True,
    )
    features, labels, groups = result["features"], result["labels"], result["groups"]
    assert sum(groups) == len(features)
    assert list(features.columns) == ["user_id", "blog_id"] + FEATURE_COLUMNS
    assert set(labels) <= {0, 1}
    assert 1 in labels.unique(), "completed reads are future positives — must be labeled"


def test_ranker_recommender_prefers_hit():
    rec = RankerRecommender(n_candidates=4, with_als=False, num_boost_round=15)
    rec.fit(_blogs(), _sessions(), _bookmarks(), _comments(), now=NOW)

    # Future: u1 completed B — the other Technology blog, NOT read in train —
    # and bounced on D (Poetry). B is the hit the ranker must learn to front.
    future_inter = pd.DataFrame({
        "user_id": ["u1", "u1"],
        "blog_id": ["B", "D"],
        "interest": [0.9, -0.1],
    })
    rec.gen_ranker_labels_and_train(future_inter)
    assert rec.booster is not None

    recs = rec.recommend("u1", top_n=4)
    assert recs, "must return something"
    assert recs[0] == "B", \
        f"the trained ranker should front-rank the future hit B, got {recs}"
    candidates = rec.build_candidates("u1")
    assert "A" not in candidates["blog_id"].values, \
        "read A must be excluded from candidates"


if __name__ == "__main__":
    import tempfile
    test_build_labels_marks_future_hits()
    with tempfile.TemporaryDirectory() as d:
        test_train_and_score_works(d)
    test_build_training_set_is_grouped_and_labeled()
    test_ranker_recommender_prefers_hit()
    print("\n✅ All ranker tests passed")
