import type { Story } from "../components/ui/story.types";

export const CURRENT_USER_HANDLE = "julianvance"; // TODO: use useAuth().user.handle
export const DEFAULT_SAVED = ["f1", "f2"]; // used only until the user saves something

export interface Author {
  name: string;
  handle: string; // no "@"
  bio: string;
  followers: number;
  following: number;
  topics: string[];
  color: string;
  joined: string;
}

export const AUTHORS: Record<string, Author> = {
  julianvance: {
    name: "Julian Vance",
    handle: "julianvance",
    bio: "A writer working through ideas on attention, typography and Stoic philosophy. New essays every other week.",
    followers: 2410,
    following: 184,
    topics: ["Philosophy", "Literature", "Productivity"],
    color: "bg-[#B27D56]",
    joined: "October 2026",
  },
  bethanytorres: {
    name: "Bethany Torres",
    handle: "bethanytorres",
    bio: "Essays on slowness, craft and the shape of a good day.",
    followers: 5120,
    following: 96,
    topics: ["Essays", "Culture"],
    color: "bg-[#7E57C2]",
    joined: "March 2025",
  },
  marcuschen: {
    name: "Marcus Chen",
    handle: "marcuschen",
    bio: "Engineer writing about software that lasts.",
    followers: 8930,
    following: 142,
    topics: ["Technology", "Craft"],
    color: "bg-[#26A69A]",
    joined: "June 2024",
  },
  elenarostova: {
    name: "Elena Rostova",
    handle: "elenarostova",
    bio: "Typographer. Notes on type, space and silence.",
    followers: 3340,
    following: 211,
    topics: ["Design", "Typography"],
    color: "bg-[#EF5350]",
    joined: "January 2025",
  },
  sophiaalmansoor: {
    name: "Sophia Al-Mansoor",
    handle: "sophiaalmansoor",
    bio: "Investigative journalist covering water and geopolitics.",
    followers: 104000,
    following: 185,
    topics: ["Geopolitics", "Climate"],
    color: "bg-[#66BB6A]",
    joined: "August 2023",
  },
  amaraokafor: {
    name: "Amara Okafor",
    handle: "amaraokafor",
    bio: "Writing about food systems and the people inside them.",
    followers: 1870,
    following: 64,
    topics: ["Food", "Agriculture"],
    color: "bg-[#FFA726]",
    joined: "May 2026",
  },
};

export const FOLLOWING_HANDLES = [
  "bethanytorres",
  "marcuschen",
  "elenarostova",
  "sophiaalmansoor",
  "amaraokafor",
];

const by = (h: string) => ({ name: AUTHORS[h].name, handle: `@${h}` });

export const ALL_STORIES: Story[] = [
  {
    id: "1",
    title: "The Solitary Typographer: Architecture of Silence and Margins",
    excerpt:
      "When we strip software down to its typographical bone, we invite contemplation back into a world hyperactive on engagement metrics.",
    author: by("julianvance"),
    topic: "Essays & Reflection",
    readTime: "7 min read",
    publishedDate: "Oct 18",
    isStaffPick: true,
    isBookmarked: false,
    iconType: "letter",
  },
  {
    id: "2",
    title: "On Broadside Printing and Modern Reading Flow",
    excerpt:
      "Single-sheet printing taught readers to move down a page without friction. What can feeds and timelines learn from it?",
    author: by("julianvance"),
    topic: "Design & Craft",
    readTime: "11 min read",
    publishedDate: "Sep 29",
    isBookmarked: false,
    iconType: "quill",
  },
  {
    id: "3",
    title: "Epictetus on Modern Notification Exhaustion",
    excerpt:
      "What would the Stoics make of constant pings? Epictetus understood that peace is an active filtering of external stimuli.",
    author: by("julianvance"),
    topic: "Philosophy & Mind",
    readTime: "8 min read",
    publishedDate: "Sep 22",
    isBookmarked: false,
    iconType: "bell",
  },
  {
    id: "f1",
    title: "The Architecture of Unhurried Thought",
    excerpt:
      "When we strip software down to its typographical bone, we invite contemplation back into a world hyperactive on engagement metrics.",
    author: by("bethanytorres"),
    topic: "Essays & Reflection",
    readTime: "6 min read",
    publishedDate: "Oct 2",
    isBookmarked: false,
    iconType: "letter",
  },
  {
    id: "f2",
    title: "Notes on Typography and the Psychology of Silence",
    excerpt:
      "Kerning and generous margins do not simply organize words; they create room for the reader to breathe between paragraphs.",
    author: by("elenarostova"),
    topic: "Design & Craft",
    readTime: "4 min read",
    publishedDate: "Sep 25",
    isBookmarked: false,
    iconType: "quill",
  },
  {
    id: "f3",
    title: "Why Monolithic Craftsmanship Still Matters",
    excerpt:
      "Modern development praises fragmented services, but cohesive systems built with care cultivate durability and quiet satisfaction.",
    author: by("marcuschen"),
    topic: "Technology & Future",
    readTime: "9 min read",
    publishedDate: "Sep 28",
    isBookmarked: false,
    iconType: "bell",
  },
];

export interface Draft {
  id: string;
  title: string; // may be empty
  excerpt: string;
  updatedAt: string; // ISO
  words: number;
}

const ago = (hours: number) =>
  new Date(Date.now() - hours * 3_600_000).toISOString();

export const INITIAL_DRAFTS: Draft[] = [
  {
    id: "d1",
    title: "Why I Stopped Reading the Feed",
    excerpt: "A first pass at the essay on attention and the cost of checking.",
    updatedAt: ago(3),
    words: 812,
  },
  {
    id: "d2",
    title: "",
    excerpt: "Notes on the margins of a printed page, three paragraphs so far.",
    updatedAt: ago(52),
    words: 240,
  },
];
