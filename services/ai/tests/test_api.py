# tests/test_api.py
import pandas as pd
from recommender.api import get_recommendations, get_manifest
import recommender.api as api_module
import recommender.data.load as load_module


def test_get_recommendations_from_artifacts(tmp_path, monkeypatch):
    test_recs = pd.DataFrame([
        {"user_id": "u1", "blog_id": "b10", "rank": 1, "engine": "ranker"},
        {"user_id": "u1", "blog_id": "b20", "rank": 2, "engine": "ranker"},
        {"user_id": "u1", "blog_id": "b30", "rank": 3, "engine": "ranker"},
        {"user_id": "u2", "blog_id": "b99", "rank": 1, "engine": "hybrid"},
    ])
    parquet_path = tmp_path / "recommendations.parquet"
    test_recs.to_parquet(parquet_path, index=False)

    monkeypatch.setattr(api_module, "RECS_PARQUET_PATH", parquet_path)
    monkeypatch.setattr(api_module, "_cached_df", None)
    monkeypatch.setattr(api_module, "_cached_mtime", None)

    res = get_recommendations(user_id="u1", limit=2)
    assert res.user_id == "u1"
    assert res.count == 2
    assert res.recommendations == ["b10", "b20"]
    assert res.source == "artifacts"
    assert res.items[0].blog_id == "b10"
    assert res.items[0].rank == 1
    assert res.items[0].engine == "ranker"


def test_get_recommendations_cold_fallback(tmp_path, monkeypatch):
    empty_parquet = tmp_path / "recommendations.parquet"
    pd.DataFrame(columns=["user_id", "blog_id", "rank", "engine"]).to_parquet(empty_parquet, index=False)

    monkeypatch.setattr(api_module, "RECS_PARQUET_PATH", empty_parquet)
    monkeypatch.setattr(api_module, "_cached_df", None)
    monkeypatch.setattr(api_module, "_cached_mtime", None)

    # Stub out live DB loaders so the fallback path is hermetic: without these,
    # a reachable database returns real recommendations and this test's
    # "no data available" premise breaks.
    empty = pd.DataFrame()
    monkeypatch.setattr(load_module, "load_blogs", lambda: empty)
    monkeypatch.setattr(load_module, "load_reading_sessions", lambda: empty)
    monkeypatch.setattr(load_module, "load_blog_bookmarks", lambda: empty)
    monkeypatch.setattr(load_module, "load_comments", lambda: empty)

    res = get_recommendations(user_id="non_existent_user", limit=5)
    assert res.user_id == "non_existent_user"
    assert res.count == 0
    assert res.recommendations == []
    assert res.source == "fallback"
