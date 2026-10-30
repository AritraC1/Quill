import type {
  FeedTabPreference,
  ReadingThemePreference,
  SettingsNotificationKey,
  UserSettingsDTO,
} from "@quill/shared";

// Keep the page's local names pointing at the shared DTOs, so client and
// server can never drift apart (same contract as profile/notification APIs)
export type FeedTab = FeedTabPreference;
export type ReadingTheme = ReadingThemePreference;
export type NotificationKey = SettingsNotificationKey;
export type Preferences = UserSettingsDTO;

export type SectionId =
  | "account"
  | "profile"
  | "reading"
  | "notifications"
  | "privacy"
  | "data";
