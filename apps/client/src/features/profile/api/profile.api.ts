import type {
  FollowerListDTO,
  FollowResultDTO,
  PublicProfileDTO,
  UserProfileDTO,
} from "@quill/shared";
import { API_ROUTES } from "../../../lib/api-routes";
import { fetchWithAuth } from "../../auth/api/auth.api";

type ServerFollowingUser = {
  id: string;
  name: string;
  handle: string | null;
  avatar: string | null;
};

type SuggestedUser = {
  id: string;
  name: string;
  handle: string | null;
  avatar: string | null;
  bio: string | null;
  followers: number;
};

// GET /user/me — served from a short-lived cache so several mounts
// (feed header, profile, edit page, AppShell paths) don't each hit the API
let meCache: { at: number; data: UserProfileDTO } | null = null;
const ME_CACHE_MS = 10_000;

export async function getMeApi(force = false): Promise<UserProfileDTO> {
  if (!force && meCache && Date.now() - meCache.at < ME_CACHE_MS) {
    return meCache.data;
  }
  const data = await fetchWithAuth<UserProfileDTO>(API_ROUTES.USER.ME);
  meCache = { at: Date.now(), data };
  return data;
}

export function clearMeCache() {
  meCache = null;
}

// Edit profile — server-side persistence
export async function editProfileApi(
  payload: import("@quill/shared").EditProfileDTO,
): Promise<UserProfileDTO> {
  return fetchWithAuth<UserProfileDTO>(API_ROUTES.USER.EDIT_PROFILE, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// Public profile — GET /user/:handle
export async function getProfileByHandleApi(
  handle: string,
): Promise<PublicProfileDTO> {
  return fetchWithAuth<PublicProfileDTO>(API_ROUTES.USER.PROFILE(handle));
}

// Follow / unfollow — POST & DELETE /user/:handle/follow
export async function setFollowApi(
  handle: string,
  follow: boolean,
): Promise<FollowResultDTO> {
  return fetchWithAuth<FollowResultDTO>(API_ROUTES.USER.FOLLOW(handle), {
    method: follow ? "POST" : "DELETE",
  });
}

// People someone follows — real DB data (profile "Following" list)
export async function listFollowingApi(): Promise<ServerFollowingUser[]> {
  return fetchWithAuth<ServerFollowingUser[]>(API_ROUTES.USER.FOLLOWING);
}

// The people a writer is followed by — GET /user/:handle/followers?page&limit
// (one page at a time, so the modal can load more as the user scrolls)
export async function listFollowersApi(
  handle: string,
  page = 1,
  limit = 10,
): Promise<FollowerListDTO> {
  const url = new URL(
    API_ROUTES.USER.FOLLOWERS(handle),
    window.location.origin,
  );
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  return fetchWithAuth<FollowerListDTO>(url.pathname + url.search);
}

// Suggested users to follow — GET /user/suggestions
export async function listSuggestionsApi(
  limit = 5,
): Promise<SuggestedUser[]> {
  const url = new URL(API_ROUTES.USER.SUGGESTIONS, window.location.origin);
  url.searchParams.set("limit", String(limit));
  return fetchWithAuth<SuggestedUser[]>(url.pathname + url.search);
}
