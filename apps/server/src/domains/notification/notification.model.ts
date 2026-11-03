// Row shape of a joined notification (notifications + actor + blog title)
export interface NotificationRowModel {
  id: string;
  recipient_id: string;
  actor_id: string;
  blog_id: string | null;
  club_id: string | null; // set for club_* notification types
  type: string;
  event_key: string;
  created_at: Date;
  read_at: Date | null;
  // joined from users (actor)
  actor_name?: string | null;
  actor_handle?: string | null;
  actor_avatar?: string | null;
  // joined from blogs
  blog_title?: string | null;
  // joined from clubs
  club_name?: string | null;
}

export interface WeeklyDigestRowModel {
  recipient_id: string;
  recipient_name: string;
  email: string;
  posts: Array<{
    id: string;
    title: string;
    author_name: string;
  }>;
}
