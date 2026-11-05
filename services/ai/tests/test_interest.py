import pandas as pd
from recommender.features.interest import interest_score

NOW = pd.Timestamp("2026-11-04", tz="UTC")

def _row(**kw):
    base = dict(active_seconds=0, max_scroll=0, completed=False,
                bookmarked=False, n_comments=0, last_at=NOW)
    return {**base, **kw}

def test_bookmarked_finished_beats_bounce():
    df = pd.DataFrame([
        _row(active_seconds=400, max_scroll=100, completed=True, bookmarked=True),
        _row(active_seconds=5, max_scroll=10),
    ])
    s = interest_score(df, NOW)
    assert s[0] > s[1]
    assert s[1] < 0                       # a bounce is a negative signal

def test_old_interactions_decay():
    df = pd.DataFrame([_row(max_scroll=100, completed=True),
                       _row(max_scroll=100, completed=True,
                            last_at=NOW - pd.Timedelta(days=60))])
    s = interest_score(df, NOW)
    assert s[1] < s[0]