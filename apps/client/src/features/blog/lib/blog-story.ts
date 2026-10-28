import type { BlogResponseDTO } from "@quill/shared";
import type { Story } from "../../profile/types/story.types";
import {
  markdownToPlainText,
  readTimeMinutes,
  wordCount,
} from "./markdown";

const MAX_EXCERPT = 180;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

const SERVER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ids coming from the API are UUIDs; mock stories use plain numbers
export const isServerBlogId = (id: string): boolean => SERVER_ID.test(id);

// Blog -> the existing StoryCard format (profile/feed cards)
export function blogToStory(blog: BlogResponseDTO, ownHandle?: string): Story {
  const body = markdownToPlainText(blog.content);
  const excerpt = (blog.description || body).slice(0, MAX_EXCERPT);
  const words = wordCount(blog.content);
  const handle = blog.author?.handle ?? undefined;

  return {
    id: blog.id,
    title: blog.title || "Untitled",
    excerpt,
    author: {
      name: blog.author?.name ?? "Unknown author",
      handle: handle ? "@" + handle : undefined,
      avatar: blog.author?.avatar ?? undefined,
    },
    topic: "Writing",
    readTime: `${readTimeMinutes(words)} min read`,
    publishedDate: blog.publishedAt ? formatDate(blog.publishedAt) : "Draft",
    imageUrl: blog.images?.[0],
    isBookmarked: blog.isBookmarked,
    isStaffPick: false,
    isPinned: false,
    // only the owner gets the edit/delete menu on the card
    isMine: Boolean(ownHandle && handle && handle === ownHandle),
  };
}

// Blog -> the existing profile drafts row format
export function blogToDraft(blog: BlogResponseDTO): {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: string;
  words: number;
} {
  const body = markdownToPlainText(blog.content);
  return {
    id: blog.id,
    title: blog.title,
    excerpt: (blog.description || body || "Empty draft").slice(0, MAX_EXCERPT),
    updatedAt: blog.updatedAt,
    words: wordCount(blog.content),
  };
}
