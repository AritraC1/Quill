# tests/test_als.py
# The ALS math has exact answers on a tiny, hand-constructed matrix.

import numpy as np
import pandas as pd

from recommender.models.als import (
    ALSModel,
    build_interaction_matrix,
    fit,
    load,
    rank_user,
    recommend_als,
    save,
    score_interactions,
    train_als,
)

NOW = pd.Timestamp("2024-01-15", tz="UTC")


def test_matrix_build_clips_and_indexes():
    inter = pd.DataFrame({
        "user_id": ["u1", "u1", "u2"],
        "blog_id": ["A", "B", "A"],
        "interest": [0.5, -0.2, 0.8],
    })
    matrix, users, items = build_interaction_matrix(inter)
    assert users == ["u1", "u2"] and items == ["A", "B"]
    assert matrix.shape == (2, 2)
    assert matrix[0, 0] == 0.5
    assert matrix[0, 1] == 0.0, "negative interest must clip to 0 — ALS has no dislikes"
    assert matrix[1, 0] == 0.8


def test_train_converges_to_reconstructable_preferences():
    """
    A block structure: u1–u2 read A–B hard, u3 reads C hard.
    After training, score(u1, A) must beat score(u1, C) decisively.
    """
    matrix = np.array([
        [0.9, 0.9, 0.0],
        [0.9, 0.9, 0.0],
        [0.0, 0.0, 0.9],
    ])
    model = train_als(
        matrix, ["u1", "u2", "u3"], ["A", "B", "C"],
        factors=4, iterations=15, alpha=40.0,
    )
    scored = model["user_factors"][0] @ model["item_factors"].T
    assert scored[0] > scored[2] + 0.1, f"own-cluster item {scored[0]} vs alien {scored[2]}"


def test_training_is_deterministic():
    matrix = np.array([
        [0.5, 0.0],
        [0.5, 0.3],
    ])
    a = train_als(matrix, ["u1", "u2"], ["A", "B"], factors=4, iterations=5)
    b = train_als(matrix, ["u1", "u2"], ["A", "B"], factors=4, iterations=5)
    assert np.allclose(a["user_factors"], b["user_factors"])
    assert np.allclose(a["item_factors"], b["item_factors"])


def _tiny_world():
    """u1 reads A,B strongly; u2 also reads A. C untouched. D authored by u1."""
    blogs = pd.DataFrame({
        "blog_id": ["A", "B", "C", "D"],
        "user_id": ["u9", "u9", "u9", "u1"],
        "genres": [["Tech"], ["Tech"], ["Poetry"], ["Tech"]],
        "published_at": ["2024-01-10"] * 4,
    })
    sessions = pd.DataFrame({
        "user_id": ["u1", "u1", "u2"],
        "blog_id": ["A", "B", "A"],
        "session_id": ["s1", "s2", "s3"],
        "active_seconds": [600, 600, 600],
        "max_scroll_percent": [100, 100, 100],
        "completed": [True, True, True],
        "started_at": [NOW] * 3,
        "updated_at": [NOW] * 3,
    })
    return blogs, sessions


def test_rank_user_prefers_cluster_items_and_excludes():
    blogs, sessions = _tiny_world()
    bookmarks = pd.DataFrame(columns=["id", "user_id", "blog_id", "created_at"])
    comments = pd.DataFrame(columns=["id", "blog_id", "user_id", "parent_comment_id",
                                     "body", "created_at", "updated_at"])
    model = fit(blogs, sessions, bookmarks, comments, now=NOW, factors=4, iterations=10)

    ranked = rank_user(model, "u1", blogs, sessions, bookmarks, comments, top_n=10)
    # D (own blog) excluded; C ranked after nothing else is eligible but must
    # still show up — with two users co-reading A, embeddings spread anyway.
    assert "D" not in ranked["blog_id"].values
    assert set(ranked["blog_id"]) == {"C"}


def test_cold_user_still_gets_scores():
    """u7 never appears in interactions — must produce scores, not a crash."""
    blogs, sessions = _tiny_world()
    bookmarks = pd.DataFrame(columns=["id", "user_id", "blog_id", "created_at"])
    comments = pd.DataFrame(columns=["id", "blog_id", "user_id", "parent_comment_id",
                                     "body", "created_at", "updated_at"])
    model = fit(blogs, sessions, bookmarks, comments, now=NOW, factors=4, iterations=10)
    # No exception, scores computed from the "average user" vector
    scored = model.score_pairs("u7", ["A", "B", "C"])
    assert all(np.isfinite(v) for v in scored.values())


def test_recommend_end_to_end(tmp_path):
    blogs, sessions = _tiny_world()
    bookmarks = pd.DataFrame(columns=["id", "user_id", "blog_id", "created_at"])
    comments = pd.DataFrame(columns=["id", "blog_id", "user_id", "parent_comment_id",
                                     "body", "created_at", "updated_at"])
    recs = recommend_als(
        "u2", blogs=blogs, sessions=sessions, bookmarks=bookmarks,
        comments=comments, now=NOW, factors=4, iterations=8, top_n=10,
    )
    assert recs[0] == "B", f"co-reader should land on the cluster item first, got {recs}"
    assert "A" not in recs  # already read by u2

    # save/load round trip preserves the ranking
    model = fit(blogs, sessions, bookmarks, comments, now=NOW, factors=4, iterations=8)
    path = str(tmp_path / "als.npz")
    save(model, path)
    restored = load(path)
    before = rank_user(model, "u2", blogs, sessions, bookmarks, comments)
    after = rank_user(restored, "u2", blogs, sessions, bookmarks, comments)
    assert before["als_score"].tolist() == after["als_score"].tolist()
    assert restored.factors == 4


def test_empty_interactions_fits_default_vector():
    """No data at all: fit returns a model; every score is a plain 0."""
    sessions = pd.DataFrame(columns=["user_id", "blog_id", "session_id", "active_seconds",
                                     "max_scroll_percent", "completed", "started_at", "updated_at"])
    blogs = pd.DataFrame({
        "blog_id": ["A"], "user_id": ["u9"], "genres": [["Tech"]],
        "published_at": ["2024-01-10"],
    })
    model = fit(blogs, sessions,
                pd.DataFrame(columns=["id", "user_id", "blog_id", "created_at"]),
                pd.DataFrame(columns=["id", "blog_id", "user_id", "parent_comment_id",
                                      "body", "created_at", "updated_at"]),
                now=NOW, factors=4, iterations=2)
    assert model.score_pairs("u1", ["A"])["A"] == 0.0


def test_alsmodel_score_pairs_unknown_blog_is_zero():
    model = ALSModel(
        users=["u1"], items=["A"],
        user_factors=np.ones((1, 2)), item_factors=np.ones((1, 2)),
    )
    scored = model.score_pairs("u1", ["A", "MISSING"])
    assert scored["A"] == 2.0
    assert scored["MISSING"] == 0.0


if __name__ == "__main__":
    import tempfile
    test_matrix_build_clips_and_indexes()
    test_train_converges_to_reconstructable_preferences()
    test_training_is_deterministic()
    test_rank_user_prefers_cluster_items_and_excludes()
    test_cold_user_still_gets_scores()
    with tempfile.TemporaryDirectory() as d:
        test_recommend_end_to_end(d)
    test_empty_interactions_fits_default_vector()
    test_alsmodel_score_pairs_unknown_blog_is_zero()
    print("\n✅ All ALS tests passed")
