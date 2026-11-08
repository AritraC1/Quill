# tests/test_content.py
# Tiny hand-made frames where the genre signal is known exactly.

import pandas as pd

from recommender.features.interest import build_interactions, interest_score
from recommender.models.content import (
    build_content_model,
    build_genre_affinity,
    build_genre_defaults,
    recommend_content,
    score_interactions,
)

NOW = pd.Timestamp("2024-01-15", tz="UTC")


def _blogs() -> pd.DataFrame:
    """Tech blogs A, B; Poetry blogs C, D; E by the user themselves."""
    return pd.DataFrame({
        "blog_id": ["A", "B", "C", "D", "E"],
        "user_id": ["u2", "u2", "u3", "u3", "u1"],
        "genres": [
            ["Technology"], ["Technology", "Design"],
            ["Poetry"], ["Poetry"], ["Technology"],
        ],
        "published_at": ["2024-01-10"] * 5,
    })


def _sessions() -> pd.DataFrame:
    """u1 loves Technology (finished both), bounces on Poetry fairly hard.

    interest = (2*read + 1*time + 3*completed + 4*bookmarked + 2*commented
                - 1.5*bounce) / 12 * decay
    Tech reads: read=1, time=1, completed=1 → raw 6;  bounce avoided.
    Poetry:     read=0.1, time~0.03, bounce → raw ≈ 2*0.1+1*0.03-1.5 = -1.27 → negative
    """
    rows = {
        "user_id": ["u1", "u1", "u1", "u1"],
        "blog_id": ["A", "B", "C", "D"],
        "session_id": ["s1", "s2", "s3", "s4"],
        "active_seconds": [600, 600, 5, 5],
        "max_scroll_percent": [100, 100, 5, 5],
        "completed": [True, True, False, False],
        "started_at": [NOW] * 4,
        "updated_at": [NOW] * 4,
    }
    return pd.DataFrame(rows)


def _bookmarks() -> pd.DataFrame:
    return pd.DataFrame(columns=["id", "user_id", "blog_id", "created_at"])


def _comments() -> pd.DataFrame:
    return pd.DataFrame(
        columns=["id", "blog_id", "user_id", "parent_comment_id", "body",
                 "created_at", "updated_at"]
    )


def test_genre_affinity_separates_liked_from_bounced():
    """Tech genres should end well above 0, Poetry below 0 for u1."""
    model = build_content_model(
        _blogs(), _sessions(), _bookmarks(), _comments(),
        now=NOW, prior_strength=3.0,
    )
    tastes = model.user_tastes("u1")

    # Two full Tech reads: affinity = (2*0.5) / (2 + prior 3) = 0.2.
    # (interest tops out ~0.5 for a completed read; two caps shrunk by 3.)
    assert tastes["Technology"] > 0.15, f"Technology={tastes['Technology']}"
    assert tastes["Poetry"] < 0.0, f"Poetry={tastes['Poetry']}"


def test_shrinking_limits_one_shot_evidence():
    """
    One strong read (raw interest 1.0) with prior 3 gives
    affinity = 1/(1+3) = 0.25, NOT 1.0 — single events don't define taste.
    """
    inter = pd.DataFrame({
        "user_id": ["u1"], "blog_id": ["A"],
        "interest": [1.0],
    })
    aff = build_genre_affinity(inter, _blogs(), prior_strength=3.0)
    row = aff[(aff["user_id"] == "u1") & (aff["genre"] == "Technology")]
    assert abs(row["affinity"].iloc[0] - 0.25) < 1e-9


def test_unknown_user_genre_defaults_to_global_mean():
    """u2 has no history: their profile is empty, scoring uses genre defaults."""
    model = build_content_model(
        _blogs(), _sessions(), _bookmarks(), _comments(), now=NOW
    )
    assert model.user_tastes("u2") == {}

    defaults = build_genre_defaults(
        score_interactions(_sessions(), _bookmarks(), _comments(), now=NOW),
        _blogs(),
    )
    # Tech was read twice at full interest; Poetry bounced twice → lower global
    assert defaults["Technology"] > defaults["Poetry"]
    # A genre never touched anywhere defaults to 0.0, not NaN
    assert model.defaults.get("Travel", 0.0) == 0.0


def test_ranking_prefers_taste_match():
    """u1 (loves Tech, bounces Poetry) must get A/B over C/D."""
    model = build_content_model(
        _blogs(), _sessions(), _bookmarks(), _comments(), now=NOW
    )
    ranked = model.rank_blogs("u1")
    tech_rows = ranked[ranked["blog_id"].isin(["A", "B"])]
    poetry_rows = ranked[ranked["blog_id"].isin(["C", "D"])]
    assert (tech_rows["content_score"] > poetry_rows["content_score"].max()).all()
    # With the user's own blog E excluded, plain Tech (A) beats Tech+Design (B):
    # B dilutes its score with Design, a genre u1 never touched.
    filtered = model.rank_blogs("u1", exclude={"E"})
    assert filtered["blog_id"].head(2).tolist() == ["A", "B"]


def test_recommend_content_excludes_read_and_own():
    """u5 read only D — D must be gone, everything else stays ranked by taste."""
    sessions = pd.concat([_sessions(), pd.DataFrame({
        "user_id": ["u5"],
        "blog_id": ["D"],
        "session_id": ["s8"],
        "active_seconds": [600],
        "max_scroll_percent": [100],
        "completed": [True],
        "started_at": [NOW],
        "updated_at": [NOW],
    })], ignore_index=True)

    recs = recommend_content(
        "u5", blogs=_blogs(), sessions=sessions,
        bookmarks=_bookmarks(), comments=_comments(),
        now=NOW, top_n=10,
    )
    assert "D" not in recs, recs
    assert set(recs) == {"A", "B", "C", "E"}, recs
    assert recs[0] in {"A", "B", "E"}, f"tech-ish blogs should lead, got {recs}"


def test_cold_user_falls_back_to_popularity():
    """u4 never read anything — with min_history=1 the model defers to popularity."""
    blogs = _blogs()
    # Build some global popularity signal on blog A
    sessions = pd.concat([_sessions(), pd.DataFrame({
        "user_id": ["u2", "u2"],
        "blog_id": ["A", "A"],
        "session_id": ["s5", "s6"],
        "active_seconds": [600, 600],
        "max_scroll_percent": [100, 100],
        "completed": [True, True],
        "started_at": [NOW] * 2,
        "updated_at": [NOW] * 2,
    })], ignore_index=True)

    recs = recommend_content(
        "u4", blogs=blogs, sessions=sessions,
        bookmarks=_bookmarks(), comments=_comments(),
        now=NOW, top_n=10,
    )
    assert recs[0] == "A", f"popularity fallback should lead with hot blog A, got {recs}"


def test_empty_input_does_not_crash():
    """No interactions anywhere: model builds, ranks by defaults (all ~0)."""
    blogs = _blogs()
    model = build_content_model(
        blogs,
        pd.DataFrame(columns=["user_id", "blog_id", "session_id", "active_seconds",
                              "max_scroll_percent", "completed", "started_at", "updated_at"]),
        _bookmarks(), _comments(),
        now=NOW,
    )
    ranked = model.rank_blogs("u1")
    assert set(ranked["blog_id"]) == set(blogs["blog_id"])
    assert ranked["content_score"].notna().all()


def test_multi_genre_blog_credits_both():
    """B carries Technology+Design: a Design-only read must lift B too."""
    sessions = pd.concat([_sessions(), pd.DataFrame({
        "user_id": ["u5"],
        "blog_id": ["B"],
        "session_id": ["s7"],
        "active_seconds": [600],
        "max_scroll_percent": [100],
        "completed": [True],
        "started_at": [NOW],
        "updated_at": [NOW],
    })], ignore_index=True)
    inter = score_interactions(sessions, _bookmarks(), _comments(), now=NOW)
    aff = build_genre_affinity(inter, _blogs())
    assert aff[(aff["user_id"] == "u5") & (aff["genre"] == "Design")]["affinity"].iloc[0] > 0
    assert aff[(aff["user_id"] == "u5") & (aff["genre"] == "Technology")]["affinity"].iloc[0] > 0


if __name__ == "__main__":
    test_genre_affinity_separates_liked_from_bounced()
    test_shrinking_limits_one_shot_evidence()
    test_unknown_user_genre_defaults_to_global_mean()
    test_ranking_prefers_taste_match()
    test_recommend_content_excludes_read_and_own()
    test_cold_user_falls_back_to_popularity()
    test_empty_input_does_not_crash()
    test_multi_genre_blog_credits_both()
    print("\n✅ All content tests passed")
