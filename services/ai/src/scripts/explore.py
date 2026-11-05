"""
Data exploration script to answer: is this data good enough for a model to learn from?

Run: python -m recommender.scripts.explore
"""
from recommender.data.load import (
    load_users,
    load_blogs,
    load_reading_sessions,
    load_blog_bookmarks,
    load_comments,
    load_comment_reactions,
    load_user_follows,
    load_user_settings,
    load_club_memberships,
    load_club_blogs,
)

print("=== LOADING DATA ===")
users = load_users()
blogs = load_blogs()
sessions = load_reading_sessions()
bookmarks = load_blog_bookmarks()
comments = load_comments()
reactions = load_comment_reactions()
follows = load_user_follows()
settings = load_user_settings()
club_members = load_club_memberships()
club_blogs = load_club_blogs()

print("\n=== TABLE SIZES ===")
print(f"users:            {len(users):>8}")
print(f"blogs (published): {len(blogs):>8}")
print(f"reading_sessions: {len(sessions):>8}")
print(f"blog_bookmarks:   {len(bookmarks):>8}")
print(f"comments:         {len(comments):>8}")
print(f"comment_reactions:{len(reactions):>8}")
print(f"user_follows:     {len(follows):>8}")
print(f"user_settings:    {len(settings):>8}")
print(f"club_members:     {len(club_members):>8}")
print(f"club_blogs:       {len(club_blogs):>8}")

print("\n=== COVERAGE ===")
print(f"users with sessions:    {sessions.user_id.nunique():>6} / {len(users)} ({sessions.user_id.nunique()/len(users)*100:.1f}%)")
print(f"users with bookmarks:   {bookmarks.user_id.nunique():>6} / {len(users)} ({bookmarks.user_id.nunique()/len(users)*100:.1f}%)")
print(f"users with comments:    {comments.user_id.nunique():>6} / {len(users)} ({comments.user_id.nunique()/len(users)*100:.1f}%)")
print(f"users with reactions:   {reactions.user_id.nunique():>6} / {len(users)} ({reactions.user_id.nunique()/len(users)*100:.1f}%)")
print(f"users who follow:       {follows.follower_id.nunique():>6} / {len(users)} ({follows.follower_id.nunique()/len(users)*100:.1f}%)")
print(f"users in clubs:         {club_members.user_id.nunique():>6} / {len(users)} ({club_members.user_id.nunique()/len(users)*100:.1f}%)")
print(f"blogs with sessions:    {sessions.blog_id.nunique():>6} / {len(blogs)} ({sessions.blog_id.nunique()/len(blogs)*100:.1f}%)")
print(f"blogs with bookmarks:   {bookmarks.blog_id.nunique():>6} / {len(blogs)} ({bookmarks.blog_id.nunique()/len(blogs)*100:.1f}%)")
print(f"blogs with comments:    {comments.blog_id.nunique():>6} / {len(blogs)} ({comments.blog_id.nunique()/len(blogs)*100:.1f}%)")
print(f"blogs in clubs:         {club_blogs.blog_id.nunique():>6} / {len(blogs)} ({club_blogs.blog_id.nunique()/len(blogs)*100:.1f}%)")

if len(sessions) > 0:
    print("\n=== READING SESSIONS (primary signal) ===")
    print(f"date range: {sessions.started_at.min()} -> {sessions.started_at.max()}")
    print(f"completed sessions: {sessions.completed.sum()} / {len(sessions)} ({sessions.completed.mean()*100:.1f}%)")
    print(f"avg active_seconds: {sessions.active_seconds.mean():.1f}")
    print(f"avg max_scroll:     {sessions.max_scroll_percent.mean():.1f}%")
    
    print("\n--- Interactions per user ---")
    print(sessions.groupby("user_id").size().describe())
    
    print("\n--- Interactions per blog ---")
    print(sessions.groupby("blog_id").size().describe())
    
    print("\n--- Session quality distribution ---")
    print(sessions[["active_seconds", "max_scroll_percent"]].describe())

if len(bookmarks) > 0:
    print("\n=== BOOKMARKS (explicit positive) ===")
    print(f"date range: {bookmarks.created_at.min()} -> {bookmarks.created_at.max()}")
    print("\n--- Bookmarks per user ---")
    print(bookmarks.groupby("user_id").size().describe())
    print("\n--- Bookmarks per blog ---")
    print(bookmarks.groupby("blog_id").size().describe())

if len(comments) > 0:
    print("\n=== COMMENTS (engagement) ===")
    print(f"date range: {comments.created_at.min()} -> {comments.created_at.max()}")
    print(f"top-level comments: {(comments.parent_comment_id.isna()).sum()}")
    print(f"replies:            {(~comments.parent_comment_id.isna()).sum()}")
    print("\n--- Comments per user ---")
    print(comments.groupby("user_id").size().describe())
    print("\n--- Comments per blog ---")
    print(comments.groupby("blog_id").size().describe())

if len(reactions) > 0:
    print("\n=== REACTIONS ===")
    print(reactions.reaction_type.value_counts())
    print("\n--- Reactions per user ---")
    print(reactions.groupby("user_id").size().describe())

if len(follows) > 0:
    print("\n=== FOLLOWS (social graph) ===")
    print(f"date range: {follows.created_at.min()} -> {follows.created_at.max()}")
    print("\n--- Followers per user (in-degree) ---")
    print(follows.groupby("following_id").size().describe())
    print("\n--- Following per user (out-degree) ---")
    print(follows.groupby("follower_id").size().describe())

print("\n=== SPARSITY (user-blog matrix) ===")
# Combine all user-blog interactions
all_interactions = []
if len(sessions) > 0:
    all_interactions.append(sessions[["user_id", "blog_id"]])
if len(bookmarks) > 0:
    all_interactions.append(bookmarks[["user_id", "blog_id"]])
if len(comments) > 0:
    all_interactions.append(comments[["user_id", "blog_id"]])

if all_interactions:
    import pandas as pd
    pairs = pd.concat(all_interactions).drop_duplicates()
    total_possible = len(users) * len(blogs)
    sparsity = 1 - len(pairs) / total_possible if total_possible > 0 else 1
    print(f"unique user-blog pairs with any signal: {len(pairs)}")
    print(f"total possible pairs: {total_possible}")
    print(f"sparsity: {sparsity:.4f} ({sparsity*100:.2f}% empty)")
    print(f"density:  {(1-sparsity)*100:.4f}%")

print("\n=== DATA QUALITY ISSUES ===")
if len(sessions) > 0:
    print(f"sessions with 0 active_seconds: {(sessions.active_seconds == 0).sum()}")
    print(f"sessions with 0 scroll:         {(sessions.max_scroll_percent == 0).sum()}")
    print(f"sessions missing started_at:    {sessions.started_at.isna().sum()}")

if len(blogs) > 0:
    print(f"blogs missing genres:           {(blogs.genres.apply(lambda x: len(x) == 0 if isinstance(x, list) else True)).sum()}")
    print(f"blogs missing user_id:          {blogs.user_id.isna().sum()}")
    print(f"blogs missing published_at:     {blogs.published_at.isna().sum()}")

if len(users) > 0:
    print(f"users missing fav_genre:        {(users.fav_genre.apply(lambda x: len(x) == 0 if isinstance(x, list) else True)).sum()}")
    print(f"users missing handle:           {users.handle.isna().sum()}")
    print(f"users onboarding incomplete:    {(~users.onboarding_completed).sum()}")

print("\n=== VERDICT ===")
if len(sessions) == 0:
    print("❌ NO READING SESSIONS - primary signal missing, cannot train")
elif len(sessions) < 100:
    print("⚠️  VERY FEW SESSIONS (<100) - likely insufficient for collaborative filtering")
elif sessions.user_id.nunique() < 10:
    print("⚠️  FEW ACTIVE USERS (<10) - cold start problem dominates")
elif len(pairs) / (len(users) * len(blogs)) < 0.001:
    print("⚠️  EXTREME SPARSITY (<0.1%) - matrix factorization will struggle")
else:
    print("✅ DATA LOOKS USABLE for baseline models (popularity, content-based, light CF)")
    print("   Consider: implicit ALS on sessions, content-based on genres, hybrid with social")