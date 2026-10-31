// Row shape returned by Postgres for `SELECT * FROM comments`;
// pg keeps column names verbatim, hence the snake_case fields
export interface CommentRowModel {
  id: string;
  blog_id: string;
  user_id: string;
  parent_comment_id: string | null; // null = top-level comment
  body: string;
  deleted_at: Date | null; // set when soft-deleted
  created_at: Date;
  updated_at: Date;
}

// Row shape for queries that join users (author), count replies or paginate
export interface CommentWithContextModel extends CommentRowModel {
  author_name?: string | null;
  author_handle?: string | null;
  author_avatar?: string | null;
  reply_count?: number; // live direct replies (top-level queries)
  total_count?: string; // COUNT(*) OVER() — pagination total
}
