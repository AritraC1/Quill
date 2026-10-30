// Row shape of a joined notification (notifications + actor + blog title)
export interface NotificationRowModel {
  id: string;
  recipient_id: string;
  actor_id: string;
  blog_id: string | null;
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
}
