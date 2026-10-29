import { useCallback, useEffect, useState } from "react";
import type { UserProfileDTO } from "@quill/shared";
import type { Author } from "../../../data/mockProfiles";
import { loadStoredUser, saveStoredUser } from "../../../lib/user-store";
import { getMeApi } from "../api/profile.api";

const KEY = "quill_profile_overrides";
// AppShell (navbar) reads the avatar from this key — keep it mirrored with
// the server profile so the photo shows everywhere, not just feed/profile
const AVATAR_STORAGE_KEY = "quill_onboarding_profile";

// Write the current avatar into the storage the navbar reads from
function mirrorAvatar(avatarUrl?: string) {
  try {
    const raw = localStorage.getItem(AVATAR_STORAGE_KEY);
    const p = raw ? JSON.parse(raw) : {};
    if (avatarUrl) p.avatarUrl = avatarUrl;
    else delete p.avatarUrl;
    localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: the navbar keeps its previous snapshot */
  }
}

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

// Only real data: the name captured at sign-up (see lib/user-store.ts) until
// GET /user/me answers with the server-side profile
function defaultProfile(): Author {
  const user = loadStoredUser();
  return {
    name: user?.name ?? "",
    handle: user?.handle ?? "",
    bio: "",
    followers: 0,
    following: 0,
    topics: [],
    color: "bg-[#B27D56]",
    joined: "",
  };
}

// Everything the server knows; overlay onto the local fallback
function applyServerProfile(profile: Author, me: UserProfileDTO | null): Author {
  if (!me) return profile;

  return {
    ...profile,
    name: me.name,
    bio: me.bio ?? "", // bio stays empty when onboarding never wrote one
    avatarUrl: me.avatar ?? undefined,
    handle: me.handle ?? profile.handle,
    handleChangedAt: me.handleChangedAt ?? undefined,
    website: me.website ?? undefined,
    topics: me.favGenre.length ? topicize(me.favGenre) : [],
    joined: new Date(me.createdAt).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
  };
}

export function useOwnProfile() {
  const [editsRaw, setEdits] = useState<ProfileEdits>(read);
  const [serverProfile, setServerProfile] = useState<UserProfileDTO | null>(
    null,
  );
  // True until the first /user/me attempt resolves — pages use it to avoid
  // rendering mock/stale data before the real profile arrives
  const [loading, setLoading] = useState(true);

  // Restore the profile persisted server-side during onboarding
  useEffect(() => {
    let cancelled = false;
    getMeApi()
      .then((me) => {
        if (cancelled) return;
        setServerProfile(me);
        // Cache the server-generated handle so /<handle> routes can resolve
        // instantly on later visits (see lib/user-store.ts)
        const user = loadStoredUser();
        if (me.handle && user?.handle !== me.handle) {
          saveStoredUser({
            ...user,
            id: me.id,
            name: me.name,
            email: user?.email ?? "",
            handle: me.handle,
          });
        }
        // Mirror the server avatar so the navbar photo matches the feed/profile
        mirrorAvatar(me.avatar ?? undefined);
      })
      .catch(() => {
        /* offline / token failed: keep the local fallback until next mount */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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
      // Keep the stored name for display surfaces in sync after edits
      const user = loadStoredUser();
      if (user && next.name) {
        saveStoredUser({ ...user, name: next.name });
      }
      // Keep the navbar avatar in sync (moved here from inline logic)
      mirrorAvatar(next.avatarUrl);
    } catch {
      /* storage unavailable or full: edits stay in memory for this session */
    }
  }, []);

  return { profile, save, loading };
}
