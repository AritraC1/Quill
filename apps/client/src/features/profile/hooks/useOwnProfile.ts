import { useCallback, useState } from "react";
import { AUTHORS, CURRENT_USER_HANDLE, type Author } from "../../../data/mockProfiles";
import { loadStoredUser } from "../../../lib/user-store";

const KEY = "quill_profile_overrides";

export type ProfileEdits = Partial<
  Pick<Author, "name" | "bio" | "topics" | "website" | "avatarUrl">
>;

function read(): ProfileEdits {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProfileEdits) : {};
  } catch {
    return {};
  }
}

// The name captured at sign-up (see lib/user-store.ts) until a "get me" API exists
function defaultProfile(): Author {
  const base = { ...AUTHORS[CURRENT_USER_HANDLE] };
  const user = loadStoredUser();
  if (user?.name) {
    base.name = user.name;
  }
  return base;
}

export function useOwnProfile() {
  const [edits, setEdits] = useState<ProfileEdits>(read);

  const profile: Author = { ...defaultProfile(), ...edits };

  // Replaces the stored edits entirely, so removing the photo or website works
  const save = useCallback((next: ProfileEdits) => {
    setEdits(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      // Keep the header avatar (AppShell reads this key) in sync
      const raw = localStorage.getItem("quill_onboarding_profile");
      const p = raw ? JSON.parse(raw) : {};
      if (next.avatarUrl) p.avatarUrl = next.avatarUrl;
      else delete p.avatarUrl;
      localStorage.setItem("quill_onboarding_profile", JSON.stringify(p));
    } catch {
      /* storage unavailable or full: edits stay in memory for this session */
    }
  }, []);

  return { profile, save };
}