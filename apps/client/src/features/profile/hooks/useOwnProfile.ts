import { useCallback, useEffect, useState } from "react";
import type { UserProfileDTO } from "@quill/shared";
import { AUTHORS, CURRENT_USER_HANDLE, type Author } from "../../../data/mockProfiles";
import { loadStoredUser } from "../../../lib/user-store";
import { getMeApi } from "../api/profile.api";

const KEY = "quill_profile_overrides";

export type ProfileEdits = Partial<
  Pick<Author, "name" | "bio" | "topics" | "website" | "avatarUrl">
>;

// favGenre values are stored lowercase ("essays") — show them as pills
const topicize = (genres: string[]): string[] =>
  genres.map((genre) =>
    genre.length ? genre.charAt(0).toUpperCase() + genre.slice(1) : genre,
  );

function read(): ProfileEdits {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProfileEdits) : {};
  } catch {
    return {};
  }
}

// The name captured at sign-up (see lib/user-store.ts) until /user/me answers
function defaultProfile(): Author {
  const base = { ...AUTHORS[CURRENT_USER_HANDLE] };
  const user = loadStoredUser();
  if (user?.name) {
    base.name = user.name;
  }
  return base;
}

// Everything the server knows after onboarding; overlay onto the mock base
function applyServerProfile(profile: Author, me: UserProfileDTO | null): Author {
  if (!me) return profile;

  return {
    ...profile,
    name: me.name,
    bio: me.bio ?? "", // about stays empty when onboarding never wrote one
    avatarUrl: me.avatar ?? undefined,
    handle: me.handle ?? profile.handle,
    handleChangedAt: me.handleChangedAt ?? undefined,
    website: me.website ?? undefined,
    ...(me.favGenre.length ? { topics: topicize(me.favGenre) } : {}),
  };
}

export function useOwnProfile() {
  const [editsRaw, setEdits] = useState<ProfileEdits>(read);
  const [serverProfile, setServerProfile] = useState<UserProfileDTO | null>(
    null,
  );

  // Restore the profile persisted server-side during onboarding
  useEffect(() => {
    let cancelled = false;
    getMeApi()
      .then((me) => {
        if (!cancelled) setServerProfile(me);
      })
      .catch(() => {
        /* offline / token failed: keep the local fallback until next mount */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const base = defaultProfile();
  // Strip undefined keys so a cleared edit never blanks a server value
  const edits = Object.fromEntries(
    Object.entries(editsRaw).filter(([, v]) => v !== undefined),
  ) as ProfileEdits;
  const profile: Author = {
    ...base,
    ...applyServerProfile(base, serverProfile),
    ...edits,
  };

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
