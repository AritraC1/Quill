import { useCallback, useEffect, useRef, useState } from "react";
import { getSettingsApi, saveSettingsApi } from "../api/settings.api";
import type { UserSettingsDTO } from "@quill/shared";

const DEFAULT_SETTINGS: UserSettingsDTO = {
  genres: [],
  defaultTab: "for-you",
  textSize: 18,
  theme: "light",
  notifications: {
    appPosts: true,
    appFollowers: true,
    appScheduled: true,
    appReplies: false,
    emailDigest: true,
    emailFollowers: false,
    emailNews: false,
  },
};

export function useSettings() {
  const [settings, setSettings] = useState<UserSettingsDTO>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const savedRef = useRef(settings);
  const draftRef = useRef(settings);

  useEffect(() => {
    savedRef.current = settings;
  }, [settings]);

  useEffect(() => {
    draftRef.current = settings;
  }, [settings]);

  // Load settings on mount
  useEffect(() => {
    let cancelled = false;
    getSettingsApi()
      .then((data) => {
        if (!cancelled) {
          setSettings(data);
        }
      })
      .catch(() => {
        // Keep defaults on error
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async () => {
    setIsSaving(true);
    try {
      const saved = await saveSettingsApi(settings);
      setSettings(saved);
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  const update = useCallback(<K extends keyof UserSettingsDTO>(
    key: K,
    value: UserSettingsDTO[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return {
    settings,
    isLoading,
    isSaving,
    save,
    update,
    // Expose individual getters for convenience
    defaultTab: settings.defaultTab,
    textSize: settings.textSize,
    theme: settings.theme,
    notifications: settings.notifications,
  };
}