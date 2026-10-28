// Persists the identity captured at sign-up (id, name, email) so UI surfaces
// (feed greeting, profile page, header avatar) can display the real name
// until profile data is served from the API.

export interface StoredUser {
  id: string;
  name: string;
  email: string;
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
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
