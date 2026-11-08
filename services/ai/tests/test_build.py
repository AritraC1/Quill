# tests/test_build.py
# Feature rows must be finite, aligned, and computable with no models at all.

import numpy as np
import pandas as pd

from recommender.features.build import (
    FEATURE_COLUMNS,
    build_item_features,
    build_pair_features,
    build_user_features,
)

NOW = pd.Timestamp("2024-01-15", tz="UTC")


def _blogs():
    return pd.DataFrame({
        "blog_id": ["A", "B"],
        "user_id": ["u9", "u8"],           # different authors
        "genres": [["Technology"], ["Poetry"]],
        "published_at": ["2024-01-10", "2024-01-10"],
    })


def _interactions():
    """u1 loved A (completed), bounced B halfway."""
    return pd.DataFrame({
        "user_id": ["u1", "u1", "u2"],
        "blog_id": ["A", "B", "A"],
        "interest": [0.5, -0.1, 0.5],
        "completed": [True, False, True],
        "last_at": [NOW, NOW, NOW],
    })


def test_user_features_summarize_the_reader():
    users = build_user_features(_interactions(), NOW)
    u1 = users[users["user_id"] == "u1"].iloc[0]
    assert u1["user_reads"] == 2
    assert abs(u1["user_mean_interest"] - 0.2) < 1e-9
    assert u1["user_completion_rate"] == 0.5
    assert u1["user_recency_days"] == 0.0


def test_item_features_shrink_single_reads():
    items = build_item_features(_blogs(), _interactions(), NOW, prior_strength=4.0)
    a = items[items["blog_id"] == "A"].iloc[0]
    # two reads, interest 0.5+0.5 → 1.0/(2+4)
    assert abs(a["item_mean_interest"] - 1.0 / 6.0) < 1e-9
    assert a["item_reads"] == 2
    # blog B: one bounced read — present, finite, and the negative interest
    # shrunk by the prior: -0.1/(1+4) = -0.02
    b = items[items["blog_id"] == "B"].iloc[0]
    assert b["item_reads"] == 1
    assert abs(b["item_mean_interest"] - (-0.02)) < 1e-9
    assert np.isfinite(b["item_age_days"])


def test_pair_features_row_contract():
    pairs = pd.DataFrame({
        "user_id": ["u1", "u1"],
        "blog_id": ["A", "B"],
    })
    features = build_pair_features(pairs, _blogs(), _interactions(), NOW)
    assert list(features.columns) == ["user_id", "blog_id"] + FEATURE_COLUMNS
    assert len(features) == 2
    # No NaNs anywhere — the ranker can't eat them
    assert np.isfinite(features[FEATURE_COLUMNS].to_numpy()).all()

    # Cross features must actually differentiate the two pairs
    row_a = features[features["blog_id"] == "A"].iloc[0]
    row_b = features[features["blog_id"] == "B"].iloc[0]
    assert row_a["author_reads"] != row_b["author_reads"] or row_a["item_reads"] != row_b["item_reads"]


def test_pair_features_with_content_and_als_models():
    from recommender.models.als import fit as fit_als
    from recommender.models.content import build_content_model

    blogs = _blogs()
    sessions = pd.DataFrame({
        "user_id": ["u1"], "blog_id": ["A"], "session_id": ["s1"],
        "active_seconds": [600], "max_scroll_percent": [100],
        "completed": [True], "started_at": [NOW], "updated_at": [NOW],
    })
    bookmarks = pd.DataFrame(columns=["id", "user_id", "blog_id", "created_at"])
    comments = pd.DataFrame(columns=["id", "blog_id", "user_id", "parent_comment_id",
                                     "body", "created_at", "updated_at"])
    from recommender.models.content import score_interactions
    interactions = score_interactions(sessions, bookmarks, comments, now=NOW)

    content_model = build_content_model(blogs, sessions, bookmarks, comments, now=NOW)
    als_model = fit_als(blogs, sessions, bookmarks, comments, now=NOW, factors=4, iterations=5)

    pairs = pd.DataFrame({"user_id": ["u1"], "blog_id": ["A"]})
    features = build_pair_features(
        pairs, blogs, interactions, NOW,
        content_model=content_model, als_model=als_model,
    )
    row = features.iloc[0]
    assert row["content_score"] > 0.0, "finished A in Technology, taste must agree"
    assert np.isfinite(row["als_score"])


def test_pair_features_survive_unknown_pairs():
    """Cold user, unknown blog: features computed, no crash, all finite."""
    pairs = pd.DataFrame({"user_id": ["u7"], "blog_id": ["A"]})
    features = build_pair_features(pairs, _blogs(), _interactions(), NOW)
    assert np.isfinite(features[FEATURE_COLUMNS].to_numpy()).all()


def test_empty_inputs_return_empty_frames():
    e = build_user_features(pd.DataFrame(columns=["user_id", "blog_id", "interest",
                                                  "completed", "last_at"]), NOW)
    assert e.empty
    f = build_pair_features(pd.DataFrame(columns=["user_id", "blog_id"]),
                            _blogs(), pd.DataFrame(columns=["user_id", "blog_id",
                                                           "interest", "completed", "last_at"]), NOW)
    assert list(f.columns) == ["user_id", "blog_id"] + FEATURE_COLUMNS


if __name__ == "__main__":
    test_user_features_summarize_the_reader()
    test_item_features_shrink_single_reads()
    test_pair_features_row_contract()
    test_pair_features_with_content_and_als_models()
    test_pair_features_survive_unknown_pairs()
    test_empty_inputs_return_empty_frames()
    print("\n✅ All feature-building tests passed")
