export type SectionId =
  | "account"
  | "profile"
  | "reading"
  | "notifications"
  | "privacy"
  | "data";

export type FeedTab = "for-you" | "following";
export type ReadingTheme = "light" | "sepia" | "dark";

export type NotificationKey =
  | "appPosts"
  | "appFollowers"
  | "appScheduled"
  | "appReplies"
  | "emailDigest"
  | "emailFollowers"
  | "emailNews";

export interface Preferences {
  genres: string[];
  defaultTab: FeedTab;
  textSize: number;
  theme: ReadingTheme;
  notifications: Record<NotificationKey, boolean>;
}