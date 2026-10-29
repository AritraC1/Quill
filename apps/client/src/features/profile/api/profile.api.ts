import type {
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
