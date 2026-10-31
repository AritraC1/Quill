// Repository for the comments table alone. Reaction counting belongs to
// CommentReactionRepository — this file never touches comment_reactions.
import type { CreateCommentDTO } from "@quill/shared";
import { pool } from "../../core/database/db";
import type { CommentRowModel, CommentWithContextModel } from "./comment.model";

interface CommentListResult {
  items: CommentWithContextModel[];
  total: number;
}

class CommentRepository {
  // Find a comment (raw row — authors/reactions need the context query)
  async findCommentById(id: string): Promise<CommentRowModel | null> {
    const query = `
      SELECT * FROM comments WHERE id = $1 LIMIT 1;
    `;
    const result = await pool.query<CommentRowModel>(query, [id]);
    return result.rows[0] || null;
  }

  // Find a comment with its author joined (serialized responses)
  async findWithAuthor(id: string): Promise<CommentWithContextModel | null> {
    const query = `
      SELECT c.*, u.name AS author_name, u.handle AS author_handle,
             u.avatar AS author_avatar
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
      LIMIT 1;
    `;
    const result = await pool.query<CommentWithContextModel>(query, [id]);
    return result.rows[0] || null;
  }

  // Create a comment (top-level when parentCommentId is null, reply otherwise)
  async createComment(
    blogId: string,
    userId: string,
    data: CreateCommentDTO,
  ): Promise<CommentRowModel> {
    const query = `
      INSERT INTO comments (blog_id, user_id, parent_comment_id, body)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const result = await pool.query<CommentRowModel>(query, [
      blogId,
      userId,
      data.parentCommentId ?? null,
      data.body,
    ]);
    return result.rows[0]!;
  }

  // Save an edit (only live rows; the service checks ownership first)
  async updateBody(
    commentId: string,
    body: string,
  ): Promise<CommentRowModel | null> {
    const query = `
      UPDATE comments
      SET body = $2, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;
    const result = await pool.query<CommentRowModel>(query, [commentId, body]);
    return result.rows[0] ?? null;
  }

  // Soft delete — the row stays so replies keep a place in the thread
  async softDelete(commentId: string): Promise<boolean> {
    const query = `
      UPDATE comments
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL;
    `;
    const result = await pool.query(query, [commentId]);
    return (result.rowCount ?? 0) > 0;
  }

  // One page of a blog's top-level comments, newest first, with the number
  // of live direct replies. Pagination total rides along (COUNT(*) OVER()).
  async listTopLevel(
    blogId: string,
    page: number,
    limit: number,
  ): Promise<CommentListResult> {
    const offset = (page - 1) * limit;
    const query = `
      SELECT c.*, u.name AS author_name, u.handle AS author_handle,
             u.avatar AS author_avatar,
             (
               SELECT COUNT(*)
               FROM comments r
               WHERE r.parent_comment_id = c.id AND r.deleted_at IS NULL
             )::INT AS reply_count,
             COUNT(*) OVER() AS total_count
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.blog_id = $1 AND c.parent_comment_id IS NULL
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const result = await pool.query<
      CommentWithContextModel & { total_count: string }
    >(query, [blogId, limit, offset]);
    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  // Every live direct reply of the given parents, conversation order
  // (oldest first). The UI shows one reply level, so this never recurses.
  async listReplies(parentIds: string[]): Promise<CommentWithContextModel[]> {
    if (parentIds.length === 0) return [];
    const query = `
      SELECT c.*, u.name AS author_name, u.handle AS author_handle,
             u.avatar AS author_avatar
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.parent_comment_id = ANY($1::uuid[]) AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC;
    `;
    const result = await pool.query<CommentWithContextModel>(query, [
      parentIds,
    ]);
    return result.rows;
  }
}

export default CommentRepository;
