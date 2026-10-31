// CommentSection — comments under a published story. Threads render two
// levels: top-level comments (newest first) each holding their replies.
// Reaction buttons update optimistically (same pattern as the bookmark
// toggle) and revert with an error toast if the request fails.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  Heart,
  Loader2,
  MessageSquare,
  Pencil,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { CommentDTO, CommentReactionType } from "@quill/shared";
import {
  createCommentApi,
  deleteCommentApi,
  listCommentsApi,
  removeCommentReactionApi,
  setCommentReactionApi,
  updateCommentApi,
} from "../api/comment.api";
import { assetUrl } from "../../auth/api/auth.api";
import { loadStoredUser } from "../../../lib/user-store";
import { getInitials } from "../../../lib/initials";
import { formatRelativeTime } from "../../../lib/datetime";

const PAGE_SIZE = 10;
const MAX_BODY = 5_000;

/** Avatar (photo or initials tile) shared by comments of both levels */
function CommentAvatar({
  name,
  avatar,
}: {
  name: string;
  avatar?: string | null;
}) {
  const src = assetUrl(avatar ?? undefined);
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="w-8 h-8 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-[#B27D56] text-white text-[12px] font-editorial flex items-center justify-center select-none">
      {getInitials(name) || "?"}
    </div>
  );
}

interface ErrorLike {
  message?: string;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

const CommentSection = ({ blogId }: { blogId: string }) => {
  // Identity comes from the sign-in snapshot the app already keeps
  // (see lib/user-store.ts) — ownership checks are server-verified anyway
  const [viewerId] = useState(() => loadStoredUser()?.id ?? null);

  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  // "View replies" control — threads start collapsed
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Read / reload the first page ("handle" = event-handler only, like useNotifications)
  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listCommentsApi(blogId, 1, PAGE_SIZE);
      setComments(result.items);
      setTotal(result.total);
      setPage(1);
    } catch {
      // keep whatever is shown; the section still renders with an error note
      toast.error("Could not load comments");
    } finally {
      setLoading(false);
    }
  }, [blogId]);

  useEffect(() => {
    void fetchFirstPage();
  }, [fetchFirstPage]);

  const loadMore = async () => {
    if (loadingMore || comments.length >= total) return;
    setLoadingMore(true);
    try {
      const result = await listCommentsApi(blogId, page + 1, PAGE_SIZE);
      // An optimistic prepend can shift server offsets — drop any row the
      // viewer already sees before merging the page
      setComments((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...result.items.filter((c) => !seen.has(c.id))];
      });
      setTotal(result.total);
      setPage(page + 1);
    } catch {
      toast.error("Could not load more comments");
    } finally {
      setLoadingMore(false);
    }
  };

  /** Patch a comment (top-level or nested reply) in local state */
  const updateLocal = useCallback(
    (commentId: string, updater: (comment: CommentDTO) => CommentDTO) => {
      setComments((prev) =>
        prev.map((comment) => {
          if (comment.id === commentId) return updater(comment);
          if (!comment.replies) return comment;
          return {
            ...comment,
            replies: comment.replies.map((reply) =>
              reply.id === commentId ? updater(reply) : reply,
            ),
          };
        }),
      );
    },
    [],
  );

  const findComment = useCallback(
    (commentId: string): CommentDTO | undefined => {
      // Two levels: direct hits plus replies nested one level down
      for (const comment of comments) {
        if (comment.id === commentId) return comment;
        const nested = comment.replies?.find((reply) => reply.id === commentId);
        if (nested) return nested;
      }
      return undefined;
    },
    [comments],
  );

  /** Reaction toggle, optimistic — mirrors the bookmark pattern */
  const toggleReaction = (
    commentId: string,
    reactionType: CommentReactionType,
  ) => {
    const comment = findComment(commentId);
    if (!comment) return;

    const had = comment.viewerReactions.includes(reactionType);
    const delta = had ? -1 : 1;
    const optimistic = {
      ...comment,
      viewerReactions: had
        ? comment.viewerReactions.filter((t) => t !== reactionType)
        : [...comment.viewerReactions, reactionType],
      reactions: {
        ...comment.reactions,
        [reactionType]: Math.max(comment.reactions[reactionType] + delta, 0),
        total: Math.max(comment.reactions.total + delta, 0),
      },
    };

    updateLocal(commentId, () => optimistic);
    (had ? removeCommentReactionApi : setCommentReactionApi)(
      commentId,
      reactionType,
    )
      .then((result) =>
        updateLocal(commentId, (current) => ({
          ...current,
          viewerReactions: result.viewerReactions,
        })),
      )
      .catch(() => {
        updateLocal(commentId, () => comment); // revert
        toast.error("Could not update reaction");
      });
  };

  /** Add a comment or reply. parentId set ⇒ reply appended under its thread */
  const submitComment = async (parentId?: string | null) => {
    const text = (parentId ? replyBody : body).trim();
    if (!text) return;

    setSubmitting(true);
    try {
      const created = await createCommentApi(blogId, {
        body: text,
        ...(parentId ? { parentCommentId: parentId } : {}),
      });

      if (parentId) {
        setReplyBody("");
        setReplyTo(null);
        setExpanded((prev) => ({ ...prev, [parentId]: true }));
        updateLocal(parentId, (parent) => ({
          ...parent,
          replyCount: parent.replyCount + 1,
          replies: [...(parent.replies ?? []), { ...created, replies: undefined }],
        }));
      } else {
        setBody("");
        setComments((prev) => [{ ...created, replies: [] }, ...prev]);
        setTotal((t) => t + 1);
      }
    } catch (error) {
      toast.error(
        errorMessage(
          error as ErrorLike,
          parentId ? "Could not post your reply" : "Could not post your comment",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const saveEdit = async (commentId: string) => {
    const text = editBody.trim();
    if (!text) return;
    try {
      const updated = await updateCommentApi(commentId, { body: text });
      updateLocal(commentId, (comment) => ({
        ...comment,
        body: updated.body,
        updatedAt: updated.updatedAt,
      }));
      setEditingId(null);
    } catch (error) {
      toast.error(errorMessage(error as ErrorLike, "Could not save the edit"));
    }
  };

  const removeComment = async (commentId: string) => {
    try {
      await deleteCommentApi(commentId);
      updateLocal(commentId, (comment) => ({
        ...comment,
        body: "",
        deletedAt: new Date().toISOString(),
      }));
      toast("Comment deleted");
    } catch (error) {
      toast.error(
        errorMessage(error as ErrorLike, "Could not delete the comment"),
      );
    }
  };

  /** One comment row (used for both levels — only "Reply" differs) */
  const renderComment = (comment: CommentDTO, isReply: boolean) => {
    const isDeleted = comment.deletedAt !== null;
    const isOwner = viewerId === comment.userId && !isDeleted;
    const isEditing = editingId === comment.id;
    const showReplyForm = replyTo === comment.id;

    return (
      <div
        key={comment.id}
        className={isReply ? "mt-4" : "mt-6 first:mt-0"}
      >
        <div className="flex gap-3">
          <div className={isReply ? "w-8 shrink-0" : "w-9 shrink-0"}>
            <CommentAvatar
              name={comment.author.name}
              avatar={comment.author.avatar}
            />
          </div>

          <div className="min-w-0 flex-1">
            {/* Author + time */}
            <div className="flex items-baseline gap-2">
              <span className="text-[13.5px] font-medium text-[#1B1F1C]">
                {comment.author.handle ? (
                  <Link
                    to={`/${comment.author.handle}`}
                    className="hover:underline hover:text-[#1F3D2F] transition-colors"
                  >
                    {comment.author.name}
                  </Link>
                ) : (
                  comment.author.name
                )}
              </span>
              <span className="text-[11.5px] text-[#8A8F8B]">
                {formatRelativeTime(comment.createdAt)}
              </span>
            </div>

            {/* Body / inline edit / deleted placeholder */}
            {isDeleted ? (
              <p className="mt-1 text-[13.5px] italic text-[#8A8F8B]">
                Comment deleted
              </p>
            ) : isEditing ? (
              <div className="mt-1.5">
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  maxLength={MAX_BODY}
                  rows={3}
                  className="w-full rounded-lg border border-[#DDD8CC] bg-white px-3 py-2 text-[13.5px] text-[#1B1F1C] focus:border-[#1F3D2F] focus:outline-none resize-y"
                />
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    disabled={!editBody.trim() || submitting}
                    onClick={() => void saveEdit(comment.id)}
                    className="px-3 py-1 rounded-full bg-[#1F3D2F] text-white text-[12.5px] disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1 rounded-full text-[12.5px] text-[#5C625E] hover:bg-[#F0EDE4] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-[13.5px] leading-6 text-[#1B1F1C] whitespace-pre-wrap break-words">
                {comment.body}
              </p>
            )}

            {/* Actions: reactions + owner controls / reply */}
            <div className="mt-1.5 flex items-center gap-3 text-[12px] text-[#8A8F8B]">
              {!isDeleted && (
                <>
                  <button
                    type="button"
                    onClick={() => toggleReaction(comment.id, "like")}
                    title="Like"
                    className={`inline-flex items-center gap-1 hover:text-[#1F3D2F] transition-colors ${
                      comment.viewerReactions.includes("like")
                        ? "text-[#1F3D2F]"
                        : ""
                    }`}
                  >
                    <ThumbsUp
                      className={`w-3.5 h-3.5 ${
                        comment.viewerReactions.includes("like")
                          ? "fill-[#1F3D2F]"
                          : ""
                      }`}
                    />
                    {comment.reactions.like > 0 && comment.reactions.like}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleReaction(comment.id, "heart")}
                    title="Love it"
                    className={`inline-flex items-center gap-1 hover:text-[#B27D56] transition-colors ${
                      comment.viewerReactions.includes("heart")
                        ? "text-[#B27D56]"
                        : ""
                    }`}
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        comment.viewerReactions.includes("heart")
                          ? "fill-[#B27D56]"
                          : ""
                      }`}
                    />
                    {comment.reactions.heart > 0 && comment.reactions.heart}
                  </button>

                  {/* Reply only starts at the top level */}
                  {!isReply && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(replyTo === comment.id ? null : comment.id);
                        setReplyBody("");
                      }}
                      className="hover:text-[#1F3D2F] transition-colors"
                    >
                      Reply
                    </button>
                  )}

                  {isOwner && (
                    <span className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        title="Edit comment"
                        onClick={() => {
                          setEditingId(comment.id);
                          setEditBody(comment.body);
                        }}
                        className="p-1 rounded hover:text-[#1F3D2F] hover:bg-[#F0EDE4] transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Delete comment"
                        onClick={() => void removeComment(comment.id)}
                        className="p-1 rounded hover:text-red-700 hover:bg-[#F0EDE4] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Inline reply form (top level only) */}
            {!isReply && showReplyForm && (
              <div className="mt-2 flex gap-2">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  maxLength={MAX_BODY}
                  rows={2}
                  placeholder={`Reply to ${comment.author.name}…`}
                  className="w-full rounded-lg border border-[#DDD8CC] bg-white px-3 py-2 text-[13px] text-[#1B1F1C] focus:border-[#1F3D2F] focus:outline-none resize-y"
                />
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    disabled={!replyBody.trim() || submitting}
                    onClick={() => void submitComment(comment.id)}
                    className="px-3 py-1 rounded-full bg-[#1F3D2F] text-white text-[12px] disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="px-3 py-1 rounded-full text-[12px] text-[#5C625E] hover:bg-[#F0EDE4] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Replies — "View replies" keeps long threads collapsed */}
            {!isReply && comment.replyCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [comment.id]: !prev[comment.id],
                  }))
                }
                className="mt-2 inline-flex items-center gap-1 text-[12px] text-[#5C625E] hover:text-[#1F3D2F] transition-colors"
              >
                {expanded[comment.id] ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                {expanded[comment.id] ? "Hide replies" : "View replies"}
                {comment.replyCount > 0 && ` · ${comment.replyCount}`}
              </button>
            )}
            {!isReply && expanded[comment.id] && comment.replies && (
              <div className="mt-3 border-l-2 border-[#EEEAE0] pl-3.5">
                {comment.replies.map((reply) => renderComment(reply, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="mt-12 border-t border-[#EEEAE0] pt-8">
      <h2 className="font-editorial text-[20px] text-[#1B1F1C]">
        Comments ({total})
      </h2>

      {/* New comment */}
      <div className="mt-5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX_BODY}
          rows={3}
          placeholder="Share your thoughts…"
          className="w-full rounded-lg border border-[#DDD8CC] bg-white px-3.5 py-2.5 text-[14px] text-[#1B1F1C] focus:border-[#1F3D2F] focus:outline-none resize-y"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={!body.trim() || submitting}
            onClick={() => void submitComment()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#1F3D2F] text-white text-[13px] disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {submitting && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            Comment
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[#1F3D2F]" />
        </div>
      ) : comments.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-10 text-[13.5px] text-[#8A8F8B]">
          <MessageSquare className="w-4 h-4" />
          No comments yet — be the first to respond.
        </div>
      ) : (
        <div className="mt-6">
          {comments.map((comment) => renderComment(comment, false))}
          {comments.length < total && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="mt-6 w-full py-2 text-[13px] text-[#5C625E] hover:text-[#1F3D2F] transition-colors disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : "Load more comments"}
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default CommentSection;
