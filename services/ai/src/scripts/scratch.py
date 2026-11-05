import pandas as pd
from recommender.data.load import load_reading_sessions, load_blog_bookmarks, load_comments
from recommender.features.interest import build_interactions, interest_score

now = pd.Timestamp.now(tz="UTC")

df = build_interactions(load_reading_sessions(), load_blog_bookmarks(), load_comments())
df["score"] = interest_score(df, now)

print(df.sort_values("score", ascending=False))