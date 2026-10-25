import type { Story } from "../features/profile/types/story.types";
import { AUTHORS } from "./mockProfiles";

export type FeedStory = Story & { age: number }; // age = days old, used for "Latest"

const by = (h: string, avatar?: string) => ({
  name: AUTHORS[h].name,
  handle: `@${h}`,
  ...(avatar ? { avatar } : {}),
});

const mk = (
  id: string,
  title: string,
  excerpt: string,
  author: Story["author"],
  topic: string,
  mins: number,
  publishedDate: string,
  age: number,
  iconType: Story["iconType"],
  likesCount: number,
  commentsCount: number,
  extra: Partial<Story> = {},
): FeedStory => ({
  id, title, excerpt, author, topic, publishedDate, age, iconType, likesCount, commentsCount,
  readTime: `${mins} min read`,
  ...extra,
});

const IMG = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;
const AVA = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=200&q=80`;

export const DEFAULT_SAVED = ["4"];

export const STORIES: FeedStory[] = [
  mk("1", "The Architecture of Unhurried Thought", "When we strip software down to its typographical bone, we invite contemplation back into a world hyperactive on engagement metrics.", by("bethanytorres", AVA("photo-1544005313-94ddf0286df2")), "Essays", 6, "Oct 2", 22, "letter", 142, 18, { isStaffPick: true, imageUrl: IMG("photo-1455390582262-044cdead277a") }),
  mk("2", "Why Monolithic Craftsmanship Still Matters", "Modern development praises fragmented services, but cohesive systems built with care cultivate durability and quiet satisfaction.", by("marcuschen", AVA("photo-1507003211169-0a1dd7228f2d")), "Technology", 9, "Sep 28", 26, "quill", 98, 14, { imageUrl: IMG("photo-1499750310107-5fef28a66643") }),
  mk("3", "Notes on Typography and the Psychology of Silence", "Kerning and generous margins do not simply organize words; they create room for the reader to breathe between paragraphs.", by("elenarostova", AVA("photo-1494790108377-be9c29b29330")), "Design", 4, "Sep 25", 29, "bell", 76, 9),
  mk("4", "Epictetus on Modern Notification Exhaustion", "What would the Stoics make of constant pings? Epictetus understood that peace is an active filtering of external stimuli.", by("julianvance", AVA("photo-1534528741775-53994a69daeb")), "Philosophy", 8, "Sep 22", 32, "bell", 112, 22, { imageUrl: IMG("photo-1517842645767-c639042777db") }),
  mk("5", "The Grain Corridors of Odesa: A Silent Maritime Ledger", "Tracking the night transits of dry bulk carriers manoeuvring without transponders across the Danube delta.", by("sophiaalmansoor"), "Culture", 11, "Oct 21", 3, "letter", 298, 33, { isStaffPick: true }),
  mk("6", "What a Seed Vault Teaches Us About Patience", "Inside a frozen archive built to outlast the people who filled it, and the slow ethics of keeping things safe.", by("amaraokafor"), "Science", 7, "Oct 19", 5, "quill", 143, 9),
  mk("7", "On Broadside Printing and Modern Reading Flow", "Single-sheet printing taught readers to move down a page without friction. What can feeds and timelines learn from it?", by("julianvance"), "Design", 11, "Sep 29", 25, "quill", 331, 27),
  mk("8", "The Case for Boring Software", "Reliable systems rarely make headlines. The people who build them have a quiet kind of pride worth describing.", by("marcuschen"), "Technology", 5, "Oct 20", 4, "bell", 402, 48),
  mk("9", "Rereading Marcus Aurelius on a Train", "Notes from a long commute and a battered paperback, and what a 1,800-year-old diary says about email.", by("bethanytorres"), "Philosophy", 6, "Oct 14", 10, "letter", 187, 14),
  mk("10", "A Field Guide to Quiet Cities", "Why some places feel unhurried, and what urban planners could borrow from a Lisbon side street.", by("elenarostova"), "Culture", 8, "Oct 12", 12, "bell", 256, 22),
  mk("11", "The Solitary Typographer: Architecture of Silence and Margins", "Generous margins do not simply organize words; they create room for the reader to breathe between paragraphs.", by("julianvance"), "Essays", 7, "Oct 18", 6, "letter", 520, 57, { isStaffPick: true }),
  mk("12", "Writing Daily for a Year: What Changed", "Three hundred and sixty-five drafts later, the surprising parts were not about writing at all.", by("bethanytorres"), "Essays", 10, "Oct 6", 18, "quill", 610, 72),
];