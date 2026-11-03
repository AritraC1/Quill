// draft until the author explicitly publishes ("persisted as draft" workflow)
export type BlogStatus = "draft" | "published";

// Row shape returned by Postgres (`SELECT * FROM blogs`);
// pg keeps column names verbatim, hence the snake_case fields
export interface BlogModel {
  id: string;
  user_id: string;
  title: string; // drafts may be empty ("Untitled draft")
  content: string; // canonical markdown / rich-text source
  description?: string | null; // excerpt shown on cards — pg column is blog_description
  blog_description?: string | null; // raw column name (mapper prefers `description`)
  images?: string[] | null;
  genres?: string[];
  status: BlogStatus;
  published_at: Date | null; // set once on first publish, kept on edits
  scheduled_publish_at?: Date | null; // pending "publish later" datetime
  created_at: Date;
  updated_at: Date;
  // Club attribution + review state (columns from migration 014, NULL for
  // ordinary personal blogs)
  club_id?: string | null;
  club_review_status?: "pending" | "changes_requested" | "rejected" | null;
  version?: number; // optimistic-concurrency counter for collaborative edits
}

// Row shape for queries that join users (author) and blog_bookmarks (viewer flag)
export interface BlogWithAuthorModel extends BlogModel {
  author_name?: string | null;
  author_handle?: string | null;
  author_avatar?: string | null;
  bookmarked?: boolean;
  total_count?: string; // COUNT(*) OVER() — pagination total on list queries
  word_count?: number; // club review queue: approximate word count
}
