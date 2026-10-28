import type {
  BlogBookmarkDTO,
  BlogCountDTO,
  BlogResponseDTO,
  CreateBlogDTO,
  UpdateBlogDTO,
} from "@quill/shared";
import { API_ROUTES } from "../../../lib/api-routes";
import { fetchWithAuth } from "../../auth/api/auth.api";

interface BlogListResult {
  items: BlogResponseDTO[];
  total: number;
}

// Create a new blog — the server always persists it as a draft
export async function createBlogApi(
  payload: CreateBlogDTO,
): Promise<BlogResponseDTO> {
  return fetchWithAuth<BlogResponseDTO>(API_ROUTES.BLOG.CREATE, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Save edits — works while drafting and after publishing
export async function updateBlogApi(
  id: string,
  payload: UpdateBlogDTO,
): Promise<BlogResponseDTO> {
  return fetchWithAuth<BlogResponseDTO>(API_ROUTES.BLOG.UPDATE(id), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// Go from draft to published (requires a title server-side)
export async function publishBlogApi(id: string): Promise<BlogResponseDTO> {
  return fetchWithAuth<BlogResponseDTO>(API_ROUTES.BLOG.PUBLISH(id), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// Delete a draft or a published story
export async function deleteBlogApi(id: string): Promise<void> {
  await fetchWithAuth(API_ROUTES.BLOG.DELETE(id), { method: "DELETE" });
}

// Single blog (drafts only readable by their author)
export async function getBlogApi(id: string): Promise<BlogResponseDTO> {
  return fetchWithAuth<BlogResponseDTO>(API_ROUTES.BLOG.GET(id));
}

// Feed — every published blog, newest first
export async function listFeedApi(
  page = 1,
  limit = 10,
): Promise<BlogListResult> {
  return fetchWithAuth<BlogListResult>(
    `${API_ROUTES.BLOG.CREATE}?page=${page}&limit=${limit}`,
  );
}

// My published blogs (profile "Stories" tab)
export async function listMyPublishedApi(
  page = 1,
  limit = 20,
): Promise<BlogListResult> {
  return fetchWithAuth<BlogListResult>(
    `${API_ROUTES.BLOG.PUBLISHED}?page=${page}&limit=${limit}`,
  );
}

// My drafts (profile "Drafts" tab)
export async function listDraftsApi(
  page = 1,
  limit = 20,
): Promise<BlogListResult> {
  return fetchWithAuth<BlogListResult>(
    `${API_ROUTES.BLOG.DRAFTS}?page=${page}&limit=${limit}`,
  );
}

// Number of blogs — published / drafts / total
export async function blogCountApi(): Promise<BlogCountDTO> {
  return fetchWithAuth<BlogCountDTO>(API_ROUTES.BLOG.COUNT);
}

// Save / unsave a blog on the reading list
export async function bookmarkBlogApi(
  id: string,
  bookmarked: boolean,
): Promise<BlogBookmarkDTO> {
  return fetchWithAuth<BlogBookmarkDTO>(API_ROUTES.BLOG.BOOKMARK(id), {
    method: bookmarked ? "POST" : "DELETE",
  });
}

// My reading list (profile "Saved" tab)
export async function listBookmarksApi(
  page = 1,
  limit = 20,
): Promise<BlogListResult> {
  return fetchWithAuth<BlogListResult>(
    `${API_ROUTES.BLOG.BOOKMARKS}?page=${page}&limit=${limit}`,
  );
}
