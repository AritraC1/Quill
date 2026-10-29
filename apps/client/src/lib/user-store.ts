// Persists the identity captured at sign-up (id, name, email) so UI surfaces
// (feed greeting, profile page, header avatar) can display the real name
// until profile data is served from the API.

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  handle?: string; // cached from GET /user/me for Twitter-style /<handle> routing
}

const KEY = "quill_user";

export function loadStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed.name === "string" && parsed.name.trim()) {
      return parsed as StoredUser;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredUser(user: StoredUser): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    /* storage unavailable: UI falls back until profile APIs exist */
  }
}

export function clearStoredUser(): void {
  try {
    // The signed-out browser must not leak identity pieces to the next user:
    // profile edits, avatar cache, bookmarks and followers were previously
    // left behind on shared devices
    [
      "quill_user",
      "quill_profile_overrides",
      "quill_onboarding_profile",
      "quill_bookmarks",
      "quill_following",
    ].forEach((key) => localStorage.removeItem(key));
  } catch {
    /* noop */
  }
}
