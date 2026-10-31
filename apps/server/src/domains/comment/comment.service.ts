// Comments + reactions business rules. The service reads blogs through
// BlogRepository, comments through CommentRepository and reactions through
// CommentReactionRepository, then assembles the serialized CommentDTO.
import type {
  CommentDTO,
  CommentListDTO,
  CommentListQueryDTO,
  CommentReactionResultDTO,
  CommentReactionSummaryDTO,
  CommentReactionType,
  CreateCommentDTO,
  UpdateCommentDTO,
} from "@quill/shared";
import CommentRepository from "./comment.repository";
import CommentReactionRepository from "./comment-reaction.repository";
import BlogRepository from "../blog/blog.repository";
import type { CommentRowModel, CommentWithContextModel } from "./comment.model";
import type {
  CommentReactionCountRowModel,
  CommentReactionRowModel,
} from "./comment-reaction.model";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../core/errors";

// Pagination guard rails (same limits the blog list uses)
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

function parsePageLimit(query: CommentListQueryDTO): {
  page: number;
  limit: number;
} {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(
    Math.max(Number(query.limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  return { page: Math.floor(page), limit: Math.floor(limit) };
}

class CommentService {
  private commentRepo: CommentRepository;
  private reactionRepo: CommentReactionRepository;
  private blogRepo: BlogRepository;

  constructor() {
    this.commentRepo = new CommentRepository();
    this.reactionRepo = new CommentReactionRepository();
    this.blogRepo = new BlogRepository();
  }

  // ---------- Serialization ----------

  // Row -> DTO. Reactions/deletions turn into plain JSON; a soft-deleted
  // comment keeps its author (the thread context) but loses its body.
  private toCommentDTO(
    row: CommentWithContextModel,
    reactions: Map<string, CommentReactionSummaryDTO>,
    viewerReactions: Map<string, CommentReactionType[]>,
    replies?: CommentDTO[],
  ): CommentDTO {
    const deleted = row.deleted_at !== null;
    return {
      id: row.id,
      blogId: row.blog_id,
      userId: row.user_id,
      parentCommentId: row.parent_comment_id ?? null,
      body: deleted ? "" : row.body,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      deletedAt: deleted ? new Date(row.updated_at).toISOString() : null,
      author: {
        id: row.user_id,
        name: row.author_name ?? "Unknown author",
        handle: row.author_handle ?? null,
        avatar: row.author_avatar ?? null,
      },
      replyCount: row.reply_count ?? 0,
      reactions: reactions.get(row.id) ?? { like: 0, heart: 0, total: 0 },
      viewerReactions: viewerReactions.get(row.id) ?? [],
      ...(replies && replies.length > 0 ? { replies } : {}),
    };
  }

  // Reaction totals + the viewer's reactions for a batch of comments
  private aggregateReactions(
    commentIds: string[],
    countRows: CommentReactionCountRowModel[],
    viewerRows: CommentReactionRowModel[],
  ): {
    reactions: Map<string, CommentReactionSummaryDTO>;
    viewerReactions: Map<string, CommentReactionType[]>;
  } {
    const reactions = new Map<string, CommentReactionSummaryDTO>();
    for (const row of countRows) {
      const summary = reactions.get(row.comment_id) ?? {
        like: 0,
        heart: 0,
        total: 0,
      };
      if (row.reaction_type === "like") summary.like = row.count;
      else summary.heart = row.count;
      summary.total += row.count;
      reactions.set(row.comment_id, summary);
    }

    const viewerReactions = new Map<string, CommentReactionType[]>();
    for (const row of viewerRows) {
      const list = viewerReactions.get(row.comment_id) ?? [];
      list.push(row.reaction_type);
      viewerReactions.set(row.comment_id, list);
    }

    return { reactions, viewerReactions };
  }

  // Load author + reactions context for a single fresh comment row
  private async toSingleDTO(row: CommentRowModel): Promise<CommentDTO> {
    const withAuthor = await this.commentRepo.findWithAuthor(row.id);
    return this.toCommentDTO(withAuthor ?? row, new Map(), new Map(), []);
  }

  // ---------- Read ----------

  // One page of a blog's comments (top-level, newest first) with their direct
  // replies inline. Replies never paginate: threads stay two levels deep.
  async listComments(
    viewerId: string,
    blogId: string,
    query: CommentListQueryDTO,
  ): Promise<CommentListDTO> {
    const { page, limit } = parsePageLimit(query);

    const blog = await this.blogRepo.findBlogById(blogId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }
    // Drafts are private to their author — anyone else gets the same 404 the
    // blog endpoint returns, so the URL does not leak that a draft exists.
    if (blog.status !== "published" && blog.user_id !== viewerId) {
      throw new NotFoundError("Blog not found");
    }

    const { items, total } = await this.commentRepo.listTopLevel(
      blogId,
      page,
      limit,
    );
    if (items.length === 0) {
      return { items: [], total };
    }

    const topLevelIds = items.map((row) => row.id);
    const replyRows = await this.commentRepo.listReplies(topLevelIds);
    const allIds = [...topLevelIds, ...replyRows.map((row) => row.id)];

    const [countRows, viewerRows] = await Promise.all([
      this.reactionRepo.countsForComments(allIds),
      this.reactionRepo.listForUser(viewerId, allIds),
    ]);
    const { reactions, viewerReactions } = this.aggregateReactions(
      allIds,
      countRows,
      viewerRows,
    );

    // Replies grouped under their parent, then woven into the top-level rows
    const repliesByParent = new Map<string, CommentDTO[]>();
    for (const reply of replyRows) {
      const parent = reply.parent_comment_id;
      if (!parent) continue;
      const list = repliesByParent.get(parent) ?? [];
      list.push(this.toCommentDTO(reply, reactions, viewerReactions));
      repliesByParent.set(parent, list);
    }

    return {
      items: items.map((row) =>
        this.toCommentDTO(
          row,
          reactions,
          viewerReactions,
          repliesByParent.get(row.id) ?? [],
        ),
      ),
      total,
    };
  }

  // ---------- Write ----------

  // Post a comment (or a reply, via parentCommentId). Only published blogs
  // can be discussed; the reply target must be a live comment on this blog.
  async createComment(
    userId: string,
    blogId: string,
    data: CreateCommentDTO,
  ): Promise<CommentDTO> {
    const blog = await this.blogRepo.findBlogById(blogId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }
    if (blog.status !== "published") {
      throw new BadRequestError("Only published blogs can receive comments");
    }

    let parentCommentId: string | null = null;
    if (data.parentCommentId) {
      const parent = await this.commentRepo.findCommentById(
        data.parentCommentId,
      );
      // A reply must stay inside its own thread: parent lives on this blog.
      if (!parent || parent.blog_id !== blogId) {
        throw new BadRequestError("The comment you replied to does not exist");
      }
      if (parent.deleted_at) {
        throw new BadRequestError(
          "The comment you replied to has been deleted",
        );
      }
      // Threads stay two levels: replying to a reply attaches under its
      // top-level ancestor (the conversation is still with that reader).
      parentCommentId = parent.parent_comment_id ?? parent.id;
    }

    const created = await this.commentRepo.createComment(blogId, userId, {
      ...data,
      parentCommentId: parentCommentId ?? undefined,
    });
    return this.toSingleDTO(created);
  }

  // Save an edit — owner only, and never on a removed comment
  async updateComment(
    userId: string,
    commentId: string,
    data: UpdateCommentDTO,
  ): Promise<CommentDTO> {
    const comment = await this.commentRepo.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError("Comment not found");
    }
    if (comment.user_id !== userId) {
      throw new ForbiddenError("You can only edit your own comments");
    }
    if (comment.deleted_at) {
      throw new BadRequestError("This comment has been deleted");
    }

    const updated = await this.commentRepo.updateBody(commentId, data.body);
    if (!updated) {
      throw new BadRequestError("Failed to update comment");
    }
    const withAuthor = await this.commentRepo.findWithAuthor(updated.id);
    return this.toCommentDTO(withAuthor ?? updated, new Map(), new Map(), []);
  }

  // Delete (soft) — the row stays so replies keep their thread context
  async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.commentRepo.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError("Comment not found");
    }
    if (comment.user_id !== userId) {
      throw new ForbiddenError("You can only delete your own comments");
    }
    await this.commentRepo.softDelete(commentId);
  }

  // ---------- Reactions ----------

  // Apply (or re-apply) the viewer's reaction. Idempotent: the unique index
  // deduplicates, so a double-click never doubles the count.
  async setReaction(
    userId: string,
    commentId: string,
    reactionType: CommentReactionType,
  ): Promise<CommentReactionResultDTO> {
    const comment = await this.commentRepo.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError("Comment not found");
    }
    if (comment.deleted_at) {
      throw new BadRequestError("You cannot react to a deleted comment");
    }

    await this.reactionRepo.setReaction(commentId, userId, reactionType);
    const rows = await this.reactionRepo.listForUser(userId, [commentId]);
    return {
      commentId,
      viewerReactions: rows.map((row) => row.reaction_type),
    };
  }

  // Remove the viewer's reaction. Deleting an absent reaction is a no-op.
  async removeReaction(
    userId: string,
    commentId: string,
    reactionType: CommentReactionType,
  ): Promise<CommentReactionResultDTO> {
    const comment = await this.commentRepo.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError("Comment not found");
    }

    await this.reactionRepo.removeReaction(commentId, userId, reactionType);
    const rows = await this.reactionRepo.listForUser(userId, [commentId]);
    return {
      commentId,
      viewerReactions: rows.map((row) => row.reaction_type),
    };
  }
}

export default CommentService;
