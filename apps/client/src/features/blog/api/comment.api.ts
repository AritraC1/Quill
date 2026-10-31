// Comment API — the CommentSection under a published story. Types come from
// @quill/shared; auth cookies ride along via fetchWithAuth.
import type {
  CommentDTO,
  CommentListDTO,
  CommentReactionResultDTO,
  CommentReactionType,
  CreateCommentDTO,
  UpdateCommentDTO,
} from "@quill/shared";
import { API_ROUTES } from "../../../lib/api-routes";
import { fetchWithAuth } from "../../auth/api/auth.api";

// Page of comments — GET /blogs/:blogId/comments?page&limit
export async function listCommentsApi(
  blogId: string,
  page = 1,
  limit = 10,
): Promise<CommentListDTO> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return fetchWithAuth<CommentListDTO>(
    `${API_ROUTES.COMMENT.LIST(blogId)}?${params}`,
  );
}

// Add a comment — POST /blogs/:blogId/comments (parentCommentId = reply)
export async function createCommentApi(
  blogId: string,
  payload: CreateCommentDTO,
): Promise<CommentDTO> {
  return fetchWithAuth<CommentDTO>(API_ROUTES.COMMENT.LIST(blogId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Save an edit — PATCH /comments/:commentId
export async function updateCommentApi(
  commentId: string,
  payload: UpdateCommentDTO,
): Promise<CommentDTO> {
  return fetchWithAuth<CommentDTO>(API_ROUTES.COMMENT.UPDATE(commentId), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// Delete (soft) — DELETE /comments/:commentId
export async function deleteCommentApi(commentId: string): Promise<void> {
  await fetchWithAuth(API_ROUTES.COMMENT.DELETE(commentId), {
    method: "DELETE",
  });
}

// React (or re-apply) — PUT /comments/:commentId/reaction
export async function setCommentReactionApi(
  commentId: string,
  reactionType: CommentReactionType,
): Promise<CommentReactionResultDTO> {
  return fetchWithAuth<CommentReactionResultDTO>(
    API_ROUTES.COMMENT.REACTION(commentId),
    { method: "PUT", body: JSON.stringify({ reactionType }) },
  );
}

// Remove a reaction — DELETE /comments/:commentId/reaction
export async function removeCommentReactionApi(
  commentId: string,
  reactionType: CommentReactionType,
): Promise<CommentReactionResultDTO> {
  return fetchWithAuth<CommentReactionResultDTO>(
    API_ROUTES.COMMENT.REACTION(commentId),
    { method: "DELETE", body: JSON.stringify({ reactionType }) },
  );
}
