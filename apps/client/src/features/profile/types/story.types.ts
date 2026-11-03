export interface StoryAuthor {
  name: string;
  avatar?: string;
  handle?: string;
}

export interface Story {
  id: string;
  title: string;
  excerpt: string;
  content?: string; // full post body, used for search
  author: StoryAuthor;
  topic: string;
  genres?: string[];
  readTime: string;
  publishedDate: string;
  imageUrl?: string;
  likesCount?: number;
  commentsCount?: number;
  isBookmarked?: boolean;
  isPinned?: boolean;
  isStaffPick?: boolean;
  iconType?: "letter" | "quill" | "bell";
  /** true only for API blogs owned by the viewer — enables the edit/delete menu */
  isMine?: boolean;
}
