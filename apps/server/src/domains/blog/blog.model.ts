// draft until the author explicitly publishes ("persisted as draft" workflow)
export type BlogStatus = "draft" | "published";

// Row shape returned by Postgres (`SELECT * FROM blogs`);
// pg keeps column names verbatim, hence the snake_case fields
export interface BlogModel {
  id: string;
  user_id: string;
  title: string; // drafts may be empty ("Untitled draft")
  content: string; // canonical markdown / rich-text source
  description: string; // optional excerpt shown on cards
  images?: string[] | null;
  status: BlogStatus;
  published_at: Date | null; // set once on first publish, kept on edits
  scheduled_publish_at?: Date | null; // pending "publish later" datetime
  created_at: Date;
  updated_at: Date;
}

// Row shape for queries that join users (author) and blog_bookmarks (viewer flag)
export interface BlogWithAuthorModel extends BlogModel {
  author_name?: string | null;
  author_handle?: string | null;
  author_avatar?: string | null;
  bookmarked?: boolean;
  total_count?: string; // COUNT(*) OVER() — pagination total on list queries
}
