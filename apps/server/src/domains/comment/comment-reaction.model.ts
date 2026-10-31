// One row of comment_reactions; reaction_type is constrained to "like"/"heart"
export type CommentReactionTypeDb = "like" | "heart";

// INSERT ... RETURNING rows look like this (id included); reads usually need
// only the (comment_id, user_id, reaction_type) triple
export interface CommentReactionRowModel {
  comment_id: string;
  user_id: string;
  reaction_type: CommentReactionTypeDb;
  created_at: Date;
}

// One group-by row: how many users chose a reaction type on a comment
export interface CommentReactionCountRowModel {
  comment_id: string;
  reaction_type: CommentReactionTypeDb;
  count: number;
}
