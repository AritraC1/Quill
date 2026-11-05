import pandas as pd
from sqlalchemy import create_engine
from recommender.config import settings

# Engine is an object that manages the connection between your Python application and your database.
# Engine is a bridge between Python and the database
engine = create_engine(settings.database_url)


# Load Data
def load_users() -> pd.DataFrame:
    return pd.read_sql(
        """
        SELECT id, name, email, handle, fav_genre, avatar, bio, 
               onboarding_completed, created_at, updated_at 
        FROM users
        """,
        engine,
    )


def load_reading_sessions() -> pd.DataFrame:
    """Load reading sessions as implicit feedback events."""
    return pd.read_sql(
        """
        SELECT user_id, blog_id, session_id, active_seconds, 
               max_scroll_percent, completed, started_at, updated_at
        FROM reading_sessions
        """,
        engine,
    )


def load_blog_bookmarks() -> pd.DataFrame:
    """Load blog bookmarks as explicit positive feedback."""
    return pd.read_sql(
        """
        SELECT id, user_id, blog_id, created_at
        FROM blog_bookmarks
        """,
        engine,
    )


def load_blogs() -> pd.DataFrame:
    """Load published blogs with their genres."""
    return pd.read_sql(
        """
        SELECT id AS blog_id, user_id, title, blog_description, images,
               genres, status, published_at, created_at, updated_at
        FROM blogs
        WHERE status = 'published'
        """,
        engine,
    )


def load_comments() -> pd.DataFrame:
    """Load non-deleted comments as engagement signals."""
    return pd.read_sql(
        """
        SELECT id, blog_id, user_id, parent_comment_id, body, created_at, updated_at
        FROM comments
        WHERE deleted_at IS NULL
        """,
        engine,
    )


def load_comment_reactions() -> pd.DataFrame:
    """Load comment reactions as engagement signals."""
    return pd.read_sql(
        """
        SELECT id, comment_id, user_id, reaction_type, created_at
        FROM comment_reactions
        """,
        engine,
    )


def load_user_follows() -> pd.DataFrame:
    """Load user follows for social graph-based recommendations."""
    return pd.read_sql(
        """
        SELECT id, follower_id, following_id, created_at
        FROM user_follows
        """,
        engine,
    )


def load_user_settings() -> pd.DataFrame:
    """Load user settings for personalization."""
    return pd.read_sql(
        """
        SELECT user_id, default_tab, text_size, theme,
               notif_app_posts, notif_app_followers, notif_app_scheduled,
               notif_app_replies, notif_email_digest, notif_email_followers,
               notif_email_news, updated_at
        FROM user_settings
        """,
        engine,
    )


def load_club_memberships() -> pd.DataFrame:
    """Load club memberships for club-based recommendations."""
    return pd.read_sql(
        """
        SELECT club_id, user_id, role, joined_at
        FROM club_members
        """,
        engine,
    )


def load_club_blogs() -> pd.DataFrame:
    """Load blogs associated with clubs."""
    return pd.read_sql(
        """
        SELECT id AS blog_id, club_id, club_review_status, version
        FROM blogs
        WHERE club_id IS NOT NULL
        """,
        engine,
    )