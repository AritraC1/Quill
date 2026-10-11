import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bookmark,
  TrendingUp,
  Clock,
  Sparkles,
  Search,
  PenSquare,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../auth";

interface Post {
  id: string;
  title: string;
  excerpt: string;
  author: {
    name: string;
    avatar?: string;
  };
  genre: string;
  readTime: string;
  date: string;
}

const SAMPLE_POSTS: Post[] = [
  {
    id: "1",
    title: "The Architecture of Unhurried Thought",
    excerpt:
      "When we strip software down to its typographical bone, we invite contemplation back into a world hyperactive on engagement metrics.",
    author: { name: "Bethany Torres" },
    genre: "Essays & Reflection",
    readTime: "6 min read",
    date: "Oct 2",
  },
  {
    id: "2",
    title: "Why Monolithic Craftsmanship Still Matters",
    excerpt:
      "Modern development praises fragmented services, but cohesive systems built with care cultivate durability and quiet satisfaction.",
    author: { name: "Marcus Chen" },
    genre: "Technology & Future",
    readTime: "9 min read",
    date: "Sep 28",
  },
  {
    id: "3",
    title: "Notes on Typography and the Psychology of Silence",
    excerpt:
      "Kerning and generous margins do not simply organize words; they create room for the reader to breathe between paragraphs.",
    author: { name: "Elena Rostova" },
    genre: "Design & Craft",
    readTime: "4 min read",
    date: "Sep 25",
  },
  {
    id: "4",
    title: "Epictetus on Modern Notification Exhaustion",
    excerpt:
      "What would the Stoics make of constant pings? Epictetus understood that peace is an active filtering of external stimuli.",
    author: { name: "Julian Vance" },
    genre: "Philosophy & Mind",
    readTime: "8 min read",
    date: "Sep 22",
  },
];

export const FeedView = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"for-you" | "latest" | "bookmarks">("for-you");
  const [searchQuery, setSearchQuery] = useState("");

  interface OnboardingProfile {
    avatarUrl?: string | null;
    bio?: string;
    genres?: string[];
  }

  const [onboardingProfile] = useState<OnboardingProfile | null>(() => {
    try {
      const saved = localStorage.getItem("quill_onboarding_profile");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F3E9] text-[#232A3B] font-['Inter',ui-sans-serif,system-ui]">
      <div className="pointer-events-none fixed inset-0 grain" aria-hidden="true" />

      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-[#232A3B]/10 bg-[#F7F3E9]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <span className="font-editorial text-2xl font-semibold tracking-tight">✍🏻 Quill</span>
            </Link>

            <div className="hidden sm:flex items-center gap-2 rounded-full border border-[#232A3B]/15 bg-white/70 px-3.5 py-1.5 text-xs text-[#232A3B]">
              <Search className="w-3.5 h-3.5 text-[#232A3B]/50" />
              <input
                type="text"
                placeholder="Search stories & authors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none placeholder:text-[#232A3B]/40 text-xs w-48"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-[#232A3B] px-4 py-2 text-xs font-medium text-[#F7F3E9] hover:bg-[#3B6255] transition-colors"
            >
              <PenSquare className="w-3.5 h-3.5" />
              Draft story
            </button>

            {onboardingProfile?.avatarUrl ? (
              <img
                src={onboardingProfile.avatarUrl}
                alt="Profile"
                className="h-8 w-8 rounded-full border border-[#232A3B]/20 object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#232A3B] text-xs font-medium text-white">
                Q
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-full text-[#232A3B]/60 hover:text-[#232A3B] transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Feed Content */}
      <main className="mx-auto max-w-5xl px-5 py-8 grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* Left / Center Stories */}
        <div className="md:col-span-2 flex flex-col gap-6">
          {/* Feed Filter Tabs */}
          <div className="flex items-center gap-6 border-b border-[#232A3B]/10 pb-3 text-sm">
            <button
              type="button"
              onClick={() => setActiveTab("for-you")}
              className={`inline-flex items-center gap-1.5 pb-3 -mb-3 transition-colors ${
                activeTab === "for-you"
                  ? "border-b-2 border-[#232A3B] font-medium text-[#232A3B]"
                  : "text-[#232A3B]/60 hover:text-[#232A3B]"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#3B6255]" />
              For You
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("latest")}
              className={`inline-flex items-center gap-1.5 pb-3 -mb-3 transition-colors ${
                activeTab === "latest"
                  ? "border-b-2 border-[#232A3B] font-medium text-[#232A3B]"
                  : "text-[#232A3B]/60 hover:text-[#232A3B]"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Latest
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bookmarks")}
              className={`inline-flex items-center gap-1.5 pb-3 -mb-3 transition-colors ${
                activeTab === "bookmarks"
                  ? "border-b-2 border-[#232A3B] font-medium text-[#232A3B]"
                  : "text-[#232A3B]/60 hover:text-[#232A3B]"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Saved
            </button>
          </div>

          {/* Posts List */}
          <div className="flex flex-col divide-y divide-[#232A3B]/10">
            {SAMPLE_POSTS.map((post) => (
              <article key={post.id} className="py-6 group">
                <div className="flex items-center gap-2 text-xs text-[#232A3B]/60 mb-2">
                  <span className="font-medium text-[#232A3B]">{post.author.name}</span>
                  <span>·</span>
                  <span className="rounded-full bg-[#3B6255]/10 px-2 py-0.5 text-[11px] font-medium text-[#3B6255]">
                    {post.genre}
                  </span>
                  <span>·</span>
                  <span>{post.readTime}</span>
                </div>

                <h2 className="font-editorial text-2xl font-semibold tracking-tight text-[#232A3B] group-hover:text-[#3B6255] transition-colors cursor-pointer">
                  {post.title}
                </h2>

                <p className="mt-2 text-sm text-[#232A3B]/75 leading-relaxed">
                  {post.excerpt}
                </p>

                <div className="mt-4 flex items-center justify-between text-xs text-[#232A3B]/50">
                  <span>Published {post.date}</span>
                  <button
                    type="button"
                    className="p-1 rounded text-[#232A3B]/40 hover:text-[#232A3B] transition-colors"
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className="flex flex-col gap-6">
          {/* Profile Card if onboarded */}
          {onboardingProfile && (
            <div className="rounded-2xl border border-[#232A3B]/10 bg-white/70 p-5 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                {onboardingProfile.avatarUrl ? (
                  <img
                    src={onboardingProfile.avatarUrl}
                    alt="Author avatar"
                    className="h-12 w-12 rounded-full object-cover border border-[#232A3B]/20"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-[#232A3B] text-white flex items-center justify-center font-medium">
                    Q
                  </div>
                )}
                <div>
                  <h4 className="font-medium text-sm text-[#232A3B]">Your Quill Profile</h4>
                  <span className="text-xs text-[#3B6255]">Reader & Writer</span>
                </div>
              </div>

              {onboardingProfile.bio && (
                <p className="mt-3 text-xs text-[#232A3B]/70 italic leading-relaxed">
                  "{onboardingProfile.bio}"
                </p>
              )}

              {onboardingProfile.genres && onboardingProfile.genres.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#232A3B]/10">
                  <span className="text-[11px] font-medium text-[#232A3B]/60 uppercase tracking-wider block mb-2">
                    Followed Realms
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {onboardingProfile.genres.map((g) => (
                      <span
                        key={g}
                        className="rounded-full border border-[#3B6255]/20 bg-[#3B6255]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#3B6255] capitalize"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Curated Recommendations widget */}
          <div className="rounded-2xl border border-[#232A3B]/10 bg-white/70 p-5 backdrop-blur-sm">
            <h3 className="font-editorial text-lg font-semibold text-[#232A3B] flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#3B6255]" />
              Reading Lists
            </h3>
            <ul className="flex flex-col gap-3 text-xs">
              <li className="flex flex-col gap-1 cursor-pointer hover:text-[#3B6255] transition-colors">
                <span className="font-medium text-[#232A3B]">The Return of Personal Essays</span>
                <span className="text-[#232A3B]/60">12 curated essays · Curated by Editors</span>
              </li>
              <li className="flex flex-col gap-1 cursor-pointer hover:text-[#3B6255] transition-colors">
                <span className="font-medium text-[#232A3B]">Slow Computing in 2026</span>
                <span className="text-[#232A3B]/60">8 deep dives into low-distraction workflows</span>
              </li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default FeedView;
