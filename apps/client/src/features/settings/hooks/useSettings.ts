import { useCallback, useEffect, useState } from "react";
import { getSettingsApi, saveSettingsApi } from "../api/settings.api";
import type { UserSettingsDTO } from "@quill/shared";
import { toast } from "sonner";

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

  // Load settings on mount
  useEffect(() => {
    let cancelled = false;
    getSettingsApi()
      .then((data) => {
        if (!cancelled) {
          setSettings(data);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("Could not load saved preferences", error);
        toast.error(
          "Could not load your saved preferences. Using defaults for now.",
        );
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