import pandas as pd

KEYS = ["user_id", "blog_id"]
MAX_RAW = 12.0  # 2 + 1 + 3 + 4 + 2, the best possible raw score

# Goal: For every pair (user, blog) we want one number saying how much that user liked that blog

# Build interactions:
# To combine the scattered data for pair (user, blog) in tables: 
# reading_session, blog_bookmarks, comments into one row
def build_interactions(sessions, bookmarks, comments) -> pd.DataFrame:
    """One row per (user, blog), combining every signal."""
    s = (sessions.groupby(KEYS)
         .agg(active_seconds=("active_seconds", "sum"),
              max_scroll=("max_scroll_percent", "max"),
              completed=("completed", "max"),
              last_at=("started_at", "max"))
         .reset_index())
    
    b = (bookmarks.groupby(KEYS)
         .agg(bookmarked_at=("created_at", "max")).reset_index())
    
    c = (comments.groupby(KEYS)
         .agg(n_comments=("id", "count"), commented_at=("created_at", "max"))
         .reset_index())

    df = s.merge(b, on=KEYS, how="outer").merge(c, on=KEYS, how="outer")
    df["has_session"] = df.last_at.notna() 
    df["active_seconds"] = df.active_seconds.fillna(0)
    df["max_scroll"] = df.max_scroll.fillna(0)
    df["completed"] = df.completed.fillna(False).astype(bool)
    df["n_comments"] = df.n_comments.fillna(0)
    df["bookmarked"] = df.bookmarked_at.notna()
    
    # Ensure timestamp columns are datetime
    for col in ["last_at", "bookmarked_at", "commented_at"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], utc=True, errors="coerce")
    
    df["last_at"] = df[["last_at", "bookmarked_at", "commented_at"]].max(axis=1)
    
    return df

# Interest Score
# It turns each row into a number
def interest_score(df: pd.DataFrame, now: pd.Timestamp, half_life_days: float = 30) -> pd.Series:
    """Score in roughly [-0.1, 1], where higher means the user enjoyed the blog more."""
    read = df.max_scroll.clip(0, 100) / 100
    
    time_part = df.active_seconds.clip(upper=600) / 600
    
    has_session = (
        df["has_session"]
        if "has_session" in df.columns
        else ((df["active_seconds"] > 0) | (df["max_scroll"] > 0))
    )
    bounced = has_session & (df.active_seconds < 15) & (df.max_scroll < 20)

    raw = (2.0 * read + 1.0 * time_part + 3.0 * df.completed
           + 4.0 * df.bookmarked + 2.0 * (df.n_comments > 0)
           - 1.5 * bounced)

    age_days = (now - df.last_at).dt.total_seconds() / 86400
    
    decay = 0.5 ** (age_days / half_life_days)   # old interest counts half after 30 days
    
    return (raw / MAX_RAW) * decay
