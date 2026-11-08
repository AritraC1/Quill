# tests/test_evaluate.py
# Hand-made DataFrames where we know the answer, same idea as the other
# test files. Also tests the three leakage traps directly.

import pandas as pd

from recommender.evaluate import (
    build_relevant,
    evaluate,
    filter_blogs_by_cutoff,
    recall_at_k,
    split_by_time,
    suggest_cutoff,
)


NOW = pd.Timestamp("2024-01-15", tz="UTC")
CUTOFF = pd.Timestamp("2024-01-10", tz="UTC")


def _sessions(rows: list[tuple[str, str, str]]) -> pd.DataFrame:
    """(user, blog, started_at) rows."""
    return pd.DataFrame({
        "user_id": [u for u, _, _ in rows],
        "blog_id": [b for _, b, _ in rows],
        "session_id": [f"s{i}" for i in range(len(rows))],
        "active_seconds": [300] * len(rows),
        "max_scroll_percent": [100] * len(rows),
        "completed": [False] * len(rows),
        "started_at": [pd.Timestamp(t, tz="UTC") for _, _, t in rows],
        "updated_at": [pd.Timestamp(t, tz="UTC") for _, _, t in rows],
    })


def _empty_sessions() -> pd.DataFrame:
    return _sessions([])


def _empty_bookmarks() -> pd.DataFrame:
    return pd.DataFrame(columns=["id", "user_id", "blog_id", "created_at"])


def _empty_comments() -> pd.DataFrame:
    return pd.DataFrame(columns=["id", "blog_id", "user_id", "parent_comment_id",
                                 "body", "created_at", "updated_at"])


def test_split_by_time_past_and_future():
    sessions = _sessions([
        ("u1", "B", "2024-01-05"),   # before cutoff -> train
        ("u1", "C", "2024-01-11"),   # after cutoff  -> test
        ("u2", "D", "2024-01-10"),   # ON the cutoff -> test (at or after)
    ])
    split = split_by_time(sessions, _empty_bookmarks(), _empty_comments(), CUTOFF)

    assert set(split["train"]["sessions"]["blog_id"]) == {"B"}
    assert set(split["test"]["sessions"]["blog_id"]) == {"C", "D"}

    # Tables never overlap or lose rows
    assert len(split["train"]["sessions"]) + len(split["test"]["sessions"]) == 3
    print("✓ test_split_by_time_past_and_future")


def test_suggest_cutoff_is_quantile():
    # 8 interactions far in the past, 2 near the end: 80% quantile should
    # separate them roughly where the density changes.
    sessions = _sessions(
        [("u1", f"B{i}", f"2024-01-0{i + 1}") for i in range(8)]
        + [("u1", "C0", "2024-01-14"), ("u1", "C1", "2024-01-15")]
    )
    cutoff = suggest_cutoff(sessions, _empty_bookmarks(), _empty_comments(), fraction=0.8)
    assert cutoff > pd.Timestamp("2024-01-08", tz="UTC")
    assert cutoff < NOW
    print(f"✓ test_suggest_cutoff_is_quantile: cutoff={cutoff}")


def test_recall_at_k():
    assert recall_at_k(["P"] + ["x"] * 9, {"P", "Q"}, k=10) == 0.5  # P hit, Q missed
    assert recall_at_k(["x"] * 10, {"P", "Q"}, k=10) == 0.0
    assert recall_at_k(["Q", "P"], {"P", "Q"}, k=10) == 1.0
    assert recall_at_k(["Q"], set(), k=10) == 0.0  # no relevant blogs -> defined as 0
    print("✓ test_recall_at_k")


def test_build_relevant_threshold_drops_bounces():
    # Real read: active 300s, full scroll -> raw = 2+1 = 3 -> 0.25 > 0.2 (undecayed at cutoff)
    # Bounce: active 5s, scroll 5 -> has_session + bounced -> raw = -0.5 -> below threshold
    test = _sessions([("u1", "Good", "2024-01-12")])
    test.loc[0, "active_seconds"] = 300

    bounce = _sessions([("u1", "Bounce", "2024-01-13")])
    bounce.loc[0, "active_seconds"] = 5
    bounce.loc[0, "max_scroll_percent"] = 5

    relevant = build_relevant(
        pd.concat([test, bounce], ignore_index=True),
        _empty_bookmarks(), _empty_comments(),
        threshold=0.2, now=CUTOFF,
    )
    assert relevant == {"u1": {"Good"}}, relevant
    print("✓ test_build_relevant_threshold_drops_bounces")


def test_filter_blogs_by_cutoff():
    blogs = pd.DataFrame({
        "blog_id": ["old", "future"],
        "published_at": ["2024-01-02", "2024-01-12"],
        "user_id": ["u9", "u9"],
    })
    kept = filter_blogs_by_cutoff(blogs, CUTOFF)
    assert set(kept["blog_id"]) == {"old"}
    print("✓ test_filter_blogs_by_cutoff")


def test_perfect_recommender_wins_and_cheater_dropped():
    """
    If the recommender returns exactly the future thumbs-up, recall = 1.
    If it 'cheats' by recommending a blog published after the cutoff —
    something it could not know about — evaluate() must drop it (trap 3),
    not award the hit.
    """
    blogs = pd.DataFrame({
        "blog_id": ["train_seen", "future_hit", "future_blog"],
        "published_at": ["2024-01-01", "2024-01-06", "2024-01-11"],
        "user_id": ["u9", "u9", "u9"],
    })
    # Past: u1 read train_seen; Future: u1 read future_hit enthusiastically
    sessions = pd.concat([
        _sessions([("u1", "train_seen", "2024-01-02")]),
        _sessions([("u1", "future_hit", "2024-01-12")]),
    ], ignore_index=True)

    def perfect(user_id, train):
        return ["future_hit"]  # would only be known with leakage... but it IS a pre-cutoff blog

    def cheater(user_id, train):
        return ["future_blog"]  # published AFTER the cutoff

    ok = evaluate(perfect, sessions,
                  _empty_bookmarks(), _empty_comments(),
                  blogs, cutoff=CUTOFF, top_k=10)
    assert ok["n_users"] == 1
    assert ok["recall_at_k"] == 1.0, ok

    bad = evaluate(cheater, sessions,
                   _empty_bookmarks(), _empty_comments(),
                   blogs, cutoff=CUTOFF, top_k=10)
    assert bad["recall_at_k"] == 0.0, "future blog must not score as a hit"

    # Sanity: no relevant future interaction -> nobody is evaluated at all
    none = evaluate(perfect, _sessions([("u1", "train_seen", "2024-01-02")]),
                    _empty_bookmarks(), _empty_comments(),
                    blogs, cutoff=CUTOFF, top_k=10)
    assert none["n_users"] == 0
    print(f"  perfect: {ok['recall_at_k']}, cheater: {bad['recall_at_k']}")
    print("✓ test_perfect_recommender_wins_and_cheater_dropped")


if __name__ == "__main__":
    test_split_by_time_past_and_future()
    test_suggest_cutoff_is_quantile()
    test_recall_at_k()
    test_build_relevant_threshold_drops_bounces()
    test_filter_blogs_by_cutoff()
    test_perfect_recommender_wins_and_cheater_dropped()
    print("\n✅ All tests passed")
