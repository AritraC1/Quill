import type { UserProfileDTO } from "@quill/shared";
import { API_ROUTES } from "../../../lib/api-routes";
import { fetchWithAuth } from "../../auth/api/auth.api";

// The signed-in user's profile — bio comes from onboarding (or stays empty)
export async function getMeApi(): Promise<UserProfileDTO> {
  return fetchWithAuth<UserProfileDTO>(API_ROUTES.USER.ME);
}

// Edit profile — server-side persistence (website column pending migration)
export async function editProfileApi(
  payload: import("@quill/shared").EditProfileDTO,
): Promise<UserProfileDTO> {
  return fetchWithAuth<UserProfileDTO>(API_ROUTES.USER.EDIT_PROFILE, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
