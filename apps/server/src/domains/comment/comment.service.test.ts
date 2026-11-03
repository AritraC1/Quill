import { describe, expect, it, mock } from "bun:test";
import CommentService from "./comment.service";
import type { CommentRowModel, CommentWithContextModel } from "./comment.model";
import type { BlogModel } from "../blog/blog.model";
import type { CommentReactionRowModel } from "./comment-reaction.model";
import { BadRequestError, ForbiddenError } from "../../core/errors";

// Row builder — the shape Postgres returns for comments (snake_case fields)
function commentRow(overrides: Partial<CommentRowModel> = {}): CommentRowModel {
  return {
    id: "comment-1",
    blog_id: "blog-1",
    user_id: "author-1",
    parent_comment_id: null,
    body: "Nice story!",
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// Full blog row for the mocked BlogRepository lookups
function blogRow(overrides: Partial<BlogModel> = {}): BlogModel {
  const now = new Date();
  return {
    id: "blog-1",
    user_id: "author-1",
    title: "A Quiet Manifesto",
    content: "Some thoughts.",
    description: "",
    images: null,
    status: "published",
    published_at: now,
    scheduled_publish_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe("CommentService", () => {
  it("rejects comments on unpublished blogs", async () => {
    const service = new CommentService();
    // @ts-ignore
    service.blogRepo = {
      findBlogById: mock(async () => blogRow({ status: "draft" })),
    };

    expect(
      service.createComment("reader-1", "blog-1", { body: "Hi" }),
    ).rejects.toThrow(BadRequestError);
  });

  it("rejects replies whose parent lives on another blog", async () => {
    const service = new CommentService();
    // @ts-ignore
    service.blogRepo = {
      findBlogById: mock(async () => blogRow({ status: "published" })),
    };
    // @ts-ignore — parent comment from a different blog
    service.commentRepo = {
      findCommentById: mock(async () => commentRow({ blog_id: "blog-2" })),
      createComment: mock(async () => commentRow()),
    };

    expect(
      service.createComment("reader-1", "blog-1", {
        body: "Hi",
        parentCommentId: "comment-9",
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it("flattens replies-to-a-reply under the top-level ancestor", async () => {
    const service = new CommentService();
    // @ts-ignore
    service.blogRepo = {
      findBlogById: mock(async () => blogRow({ status: "published" })),
    };
    // A second-level comment: its parent is itself a reply (parent id set)
    const secondLevel = commentRow({
      parent_comment_id: "reply-7",
    });
    // @ts-ignore
    service.commentRepo = {
      findCommentById: mock(async () => secondLevel),
      findWithAuthor: mock(async () => ({
        ...commentRow(),
        author_name: "Reader One",
        author_handle: "readerone",
        author_avatar: null,
      })),
    };
    const createComment = mock(async () => commentRow());
    // @ts-ignore
    service.commentRepo.createComment = createComment;
    const notifyCommentReply = mock(async () => {});
    // @ts-ignore
    service.notificationService = { notifyCommentReply };

    await service.createComment("reader-1", "blog-1", {
      body: "Hi",
      parentCommentId: "comment-9",
    });

    expect(createComment).toHaveBeenCalledWith("blog-1", "reader-1", {
      body: "Hi",
      parentCommentId: "reply-7", // the ancestor, not the second-level comment
    });
    expect(notifyCommentReply).toHaveBeenCalledWith(
      "author-1",
      "reader-1",
      "blog-1",
      "comment-1",
    );
  });

  it("notifies the comment author when someone replies", async () => {
    const service = new CommentService();
    // @ts-ignore
    service.blogRepo = {
      findBlogById: mock(async () => blogRow({ status: "published" })),
    };
    // @ts-ignore
    service.commentRepo = {
      findCommentById: mock(async () => commentRow({ user_id: "parent-1" })),
      createComment: mock(async () => commentRow({
        id: "reply-1",
        user_id: "reader-1",
        parent_comment_id: "comment-1",
      })),
      findWithAuthor: mock(async () => ({
        ...commentRow({
          id: "reply-1",
          user_id: "reader-1",
          parent_comment_id: "comment-1",
        }),
        author_name: "Reader",
        author_handle: "reader",
        author_avatar: null,
      })),
    };
    const notifyCommentReply = mock(async () => {});
    // @ts-ignore
    service.notificationService = { notifyCommentReply };

    await service.createComment("reader-1", "blog-1", {
      body: "A reply",
      parentCommentId: "comment-1",
    });

    expect(notifyCommentReply).toHaveBeenCalledWith(
      "parent-1",
      "reader-1",
      "blog-1",
      "reply-1",
    );
  });

  it("forbids editing someone else's comment", async () => {
    const service = new CommentService();
    // @ts-ignore
    service.commentRepo = {
      findCommentById: mock(async () => commentRow({ user_id: "author-1" })),
    };

    expect(
      service.updateComment("intruder-1", "comment-1", { body: "hacked" }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("forbids deleting someone else's comment", async () => {
    const service = new CommentService();
    // @ts-ignore
    service.commentRepo = {
      findCommentById: mock(async () => commentRow({ user_id: "author-1" })),
    };

    expect(service.deleteComment("intruder-1", "comment-1")).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("soft-deletes an owned comment instead of removing the row", async () => {
    const service = new CommentService();
    const softDelete = mock(async () => true);
    // @ts-ignore
    service.commentRepo = {
      findCommentById: mock(async () => commentRow({ user_id: "author-1" })),
      softDelete,
    };

    await service.deleteComment("author-1", "comment-1");

    expect(softDelete).toHaveBeenCalledWith("comment-1");
  });

  it("refuses edits on comments already deleted", async () => {
    const service = new CommentService();
    // @ts-ignore
    service.commentRepo = {
      findCommentById: mock(async () =>
        commentRow({ user_id: "author-1", deleted_at: new Date() }),
      ),
    };

    expect(
      service.updateComment("author-1", "comment-1", { body: "again" }),
    ).rejects.toThrow(BadRequestError);
  });

  it("rejects reactions on deleted comments", async () => {
    const service = new CommentService();
    // @ts-ignore
    service.commentRepo = {
      findCommentById: mock(async () =>
        commentRow({ deleted_at: new Date() }),
      ),
    };

    expect(
      service.setReaction("reader-1", "comment-1", "like"),
    ).rejects.toThrow(BadRequestError);
  });

  it("keeps both reaction types per user and reports them after a set", async () => {
    const service = new CommentService();
    // @ts-ignore
    service.commentRepo = {
      findCommentById: mock(async () => commentRow()),
    };
    // @ts-ignore — upsert into comment_reactions (unique index dedupes)
    service.reactionRepo = {
      setReaction: mock(async () => undefined),
      removeReaction: mock(async () => undefined),
      listForUser: mock(async () => {
        const like: CommentReactionRowModel = {
          comment_id: "comment-1",
          user_id: "reader-1",
          reaction_type: "like",
          created_at: new Date(),
        };
        const heart: CommentReactionRowModel = {
          comment_id: "comment-1",
          user_id: "reader-1",
          reaction_type: "heart",
          created_at: new Date(),
        };
        return [like, heart];
      }),
    };

    const result = await service.setReaction("reader-1", "comment-1", "heart");

    expect(result.viewerReactions).toEqual(["like", "heart"]);
  });

  it("clamps page/limit to the guard rails (limit max 50)", async () => {
    const service = new CommentService();
    // @ts-ignore
    service.blogRepo = {
      findBlogById: mock(async () => blogRow()),
    };
    const listTopLevel = mock(async () => ({
      items: [] as CommentWithContextModel[],
      total: 0,
    }));
    // @ts-ignore
    service.commentRepo = { listTopLevel, listReplies: mock(async () => []) };

    await service.listComments("reader-1", "blog-1", { page: -3, limit: 999 });

    expect(listTopLevel).toHaveBeenCalledWith("blog-1", 1, 50);
  });
});
