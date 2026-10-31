// Repository for the comment_reactions table alone. Comment existence and
// ownership live in CommentRepository / CommentService — this file never
// queries the comments table.
import { pool } from "../../core/database/db";
import type {
  CommentReactionCountRowModel,
  CommentReactionRowModel,
} from "./comment-reaction.model";

class CommentReactionRepository {
  // Add the viewer's reaction. The unique (comment_id, user_id,
  // reaction_type) index makes a repeated identical reaction a no-op.
  async setReaction(
    commentId: string,
    userId: string,
    reactionType: "like" | "heart",
  ): Promise<void> {
    const query = `
      INSERT INTO comment_reactions (comment_id, user_id, reaction_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (comment_id, user_id, reaction_type) DO NOTHING;
    `;
    await pool.query(query, [commentId, userId, reactionType]);
  }

  // Remove one viewer reaction. Removing a reaction that was never applied
  // (or was already removed) silently succeeds.
  async removeReaction(
    commentId: string,
    userId: string,
    reactionType: "like" | "heart",
  ): Promise<void> {
    const query = `
      DELETE FROM comment_reactions
      WHERE comment_id = $1 AND user_id = $2 AND reaction_type = $3;
    `;
    await pool.query(query, [commentId, userId, reactionType]);
  }

  // The viewer's reaction types on a set of comments (the filled buttons)
  async listForUser(
    userId: string,
    commentIds: string[],
  ): Promise<CommentReactionRowModel[]> {
    if (commentIds.length === 0) return [];
    const query = `
      SELECT comment_id, user_id, reaction_type, created_at
      FROM comment_reactions
      WHERE user_id = $1 AND comment_id = ANY($2::uuid[]);
    `;
    const result = await pool.query<CommentReactionRowModel>(query, [
      userId,
      commentIds,
    ]);
    return result.rows;
  }

  // Reaction totals grouped per comment and type (count badges)
  async countsForComments(
    commentIds: string[],
  ): Promise<CommentReactionCountRowModel[]> {
    if (commentIds.length === 0) return [];
    const query = `
      SELECT comment_id, reaction_type, COUNT(*)::INT AS count
      FROM comment_reactions
      WHERE comment_id = ANY($1::uuid[])
      GROUP BY comment_id, reaction_type;
    `;
    const result = await pool.query<CommentReactionCountRowModel>(query, [
      commentIds,
    ]);
    return result.rows;
  }
}

export default CommentReactionRepository;
