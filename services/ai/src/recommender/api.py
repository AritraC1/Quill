# recommender/api.py
# FastAPI routes for recommendations serving: GET /recommendations/{user_id}
#
# Primary path: Reads precomputed recommendations from the nightly batch job
# (artifacts/recommendations.parquet).
# Fallback path: If user has no precomputed recommendations or artifact is
# missing, falls back dynamically to hybrid/popularity ranking from live data.

from pathlib import Path
from typing import Annotated, Any
import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(tags=["recommendations"])

ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts"
RECS_PARQUET_PATH = ARTIFACTS_DIR / "recommendations.parquet"
MANIFEST_PATH = ARTIFACTS_DIR / "manifest.json"

_cached_mtime: float | None = None
_cached_df: pd.DataFrame | None = None


def get_cached_recommendations() -> pd.DataFrame | None:
    """Load and cache the precomputed recommendations parquet file with mtime tracking."""
    global _cached_mtime, _cached_df
    if not RECS_PARQUET_PATH.exists():
        return None
    try:
        current_mtime = RECS_PARQUET_PATH.stat().st_mtime
        if _cached_df is None or _cached_mtime != current_mtime:
            _cached_df = pd.read_parquet(RECS_PARQUET_PATH)
            _cached_mtime = current_mtime
        return _cached_df
    except Exception:
        return None


class RecommendationItem(BaseModel):
    blog_id: str
    rank: int
    engine: str = "ranker"


class RecommendationsResponse(BaseModel):
    user_id: str
    recommendations: list[str]
    items: list[RecommendationItem]
    count: int
    source: str


def generate_online_fallback(user_id: str, top_n: int) -> list[dict[str, Any]]:
    """Generate dynamic recommendations if user is cold or missing from batch job."""
    try:
        from recommender.data.load import (
            load_blog_bookmarks,
            load_blogs,
            load_comments,
            load_reading_sessions,
        )
        from recommender.models.hybrid import recommend_hybrid

        blogs = load_blogs()
        if blogs.empty:
            return []
        sessions = load_reading_sessions()
        bookmarks = load_blog_bookmarks()
        comments = load_comments()

        blog_ids = recommend_hybrid(
            user_id=user_id,
            blogs=blogs,
            sessions=sessions,
            bookmarks=bookmarks,
            comments=comments,
            top_n=top_n,
        )
        return [
            {"blog_id": b_id, "rank": i + 1, "engine": "hybrid_online"}
            for i, b_id in enumerate(blog_ids)
        ]
    except Exception:
        # If DB connection fails or synthetic/mock fallback
        recs_df = get_cached_recommendations()
        if recs_df is not None and not recs_df.empty:
            top_popular = (
                recs_df.groupby("blog_id")
                .size()
                .sort_values(ascending=False)
                .head(top_n)
                .index.tolist()
            )
            return [
                {"blog_id": b_id, "rank": i + 1, "engine": "popularity_fallback"}
                for i, b_id in enumerate(top_popular)
            ]
        return []


@router.get("/recommendations/{user_id}", response_model=RecommendationsResponse)
def get_recommendations(
    user_id: str,
    limit: Annotated[int, Query(ge=1, le=100, description="Max recommendations to return")] = 10,
    top_n: Annotated[int | None, Query(ge=1, le=100, description="Alias for limit")] = None,
):
    """
    Get top recommendations for a user.
    Reads precomputed results from artifacts or generates online fallback.
    """
    effective_limit = top_n if (top_n is not None and isinstance(top_n, int)) else (limit if isinstance(limit, int) else 10)

    df = get_cached_recommendations()
    if df is not None and not df.empty and "user_id" in df.columns:
        user_rows = df[df["user_id"] == user_id]
        if not user_rows.empty:
            sorted_rows = user_rows.sort_values("rank").head(effective_limit)
            items = [
                RecommendationItem(
                    blog_id=str(row["blog_id"]),
                    rank=int(row["rank"]),
                    engine=str(row.get("engine", "ranker")),
                )
                for _, row in sorted_rows.iterrows()
            ]
            return RecommendationsResponse(
                user_id=user_id,
                recommendations=[item.blog_id for item in items],
                items=items,
                count=len(items),
                source="artifacts",
            )

    # Fallback path for cold users or missing precomputed artifacts
    fallback_items = generate_online_fallback(user_id, effective_limit)
    items = [
        RecommendationItem(
            blog_id=item["blog_id"],
            rank=item["rank"],
            engine=item["engine"],
        )
        for item in fallback_items
    ]
    return RecommendationsResponse(
        user_id=user_id,
        recommendations=[item.blog_id for item in items],
        items=items,
        count=len(items),
        source="fallback",
    )


@router.get("/recommendations/meta/manifest")
def get_manifest():
    """Return manifest metadata of the latest artifacts bundle."""
    if not MANIFEST_PATH.exists():
        raise HTTPException(status_code=404, detail="No artifacts manifest found")
    import json
    try:
        return json.loads(MANIFEST_PATH.read_text())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
