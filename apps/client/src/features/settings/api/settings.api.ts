import type {
  DeleteAccountResultDTO,
  UserSettingsDTO,
} from "@quill/shared";
import { API_ROUTES } from "../../../lib/api-routes";
import { fetchWithAuth } from "../../auth/api/auth.api";

// GET /user/settings — the signed-in user's saved preference snapshot.
// Returns defaults-filled data even when the user never saved before.
export async function getSettingsApi(): Promise<UserSettingsDTO> {
  return fetchWithAuth<UserSettingsDTO>(API_ROUTES.USER.SETTINGS);
}

// PUT /user/settings — persist the complete snapshot from the page's
// "Save changes" bar; the canonical saved copy is returned in the response
export async function saveSettingsApi(
  payload: UserSettingsDTO,
): Promise<UserSettingsDTO> {
  return fetchWithAuth<UserSettingsDTO>(API_ROUTES.USER.SETTINGS, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// DELETE /user/account — permanent self-service deletion. The server removes
// the user row (blogs, bookmarks, follows and sessions cascade) and clears
// the auth cookies; the stats confirm what the consent screen promised
export async function deleteAccountApi(): Promise<DeleteAccountResultDTO> {
  return fetchWithAuth<DeleteAccountResultDTO>(API_ROUTES.USER.ACCOUNT, {
    method: "DELETE",
  });
}
