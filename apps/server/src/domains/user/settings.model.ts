/** One row of `user_settings` (migration 012) joined with users.fav_genre.
 * snake_case mirrors the DB columns exactly like user.model.ts */
export interface UserSettingsRowModel {
  fav_genre: string[] | null;
  default_tab: string;
  text_size: number;
  theme: string;
  notif_app_posts: boolean;
  notif_app_followers: boolean;
  notif_app_scheduled: boolean;
  notif_app_replies: boolean;
  notif_email_digest: boolean;
  notif_email_followers: boolean;
  notif_email_news: boolean;
}

/** Result of the account-deletion transaction — what cascaded away */
export interface DeleteAccountStats {
  publishedPosts: number;
  drafts: number;
  bookmarks: number;
}
