import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, Users, Loader2 } from "lucide-react";
import { AppShell } from "../../../components/layout/AppShell";
import { StoryCard } from "../../../components/ui/StoryCard";
import { useStoredSet } from "../../../hooks/useStoredSet";
import {
  AUTHORS,
  CURRENT_USER_HANDLE,
  DEFAULT_FOLLOWING,
} from "../../../data/mockProfiles";
import { STORIES, DEFAULT_SAVED } from "../../../data/stories";
import type { BlogResponseDTO } from "@quill/shared";
import type { Story } from "../../profile/types/story.types";
import {
  listFeedApi,
  bookmarkBlogApi,
  deleteBlogApi,
} from "../../blog/api/blog.api";
import { blogToStory, isServerBlogId } from "../../blog/lib/blog-story";
import { useOwnProfile } from "../../profile/hooks/useOwnProfile";
import Empty from "../components/Empty";
import FollowButton from "../components/FollowButton";

const PAGE_SIZE = 5;

const TOPICS = [
  "All",
  "Essays",
  "Design",
  "Technology",
  "Philosophy",
  "Culture",
  "Science",
];

const TABS = [
  { id: "for-you", label: "For you", Icon: Sparkles },
  { id: "following", label: "Following", Icon: Users },
] as const;

type Tab = (typeof TABS)[number]["id"];

const FeedPage = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("for-you");
  const [topic, setTopic] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const own = useOwnProfile();

  const bookmarks = useStoredSet("quill_bookmarks", DEFAULT_SAVED);

  const following = useStoredSet("quill_following", DEFAULT_FOLLOWING);

  // Published blogs from the API, newest first (mock stories follow below)
  const [feedBlogs, setFeedBlogs] = useState<BlogResponseDTO[]>([]);

  useEffect(() => {
    let cancelled = false;
    listFeedApi(1, 20)
      .then((res) => {
        if (!cancelled) setFeedBlogs(res.items);
      })
      .catch(() => {
        /* the feed still shows local stories when the API is unreachable */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const sentinelRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      clearTimeout(loadTimer.current);
    },
    [],
  );

  const ownHandle = own.profile.handle ?? CURRENT_USER_HANDLE;

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let list: Story[] = [
      ...feedBlogs.map((b) => blogToStory(b, ownHandle)),
      ...STORIES.map((s) => ({
        ...s,
        isBookmarked: bookmarks.items.includes(s.id),
        author:
          s.author.handle === `@${CURRENT_USER_HANDLE}`
            ? {
                ...s.author,
                name: own.profile.name,
                avatar: own.profile.avatarUrl ?? s.author.avatar,
              }
            : s.author,
      })),
    ];

    if (tab === "following")
      list = list.filter((s) =>
        following.items.includes(s.author.handle!.slice(1)),
      );

    if (topic !== "All") list = list.filter((s) => s.topic === topic);

    if (q) {
      list = list.filter((s) =>
        `${s.title} ${s.excerpt} ${s.author.name} ${s.topic}`
          .toLowerCase()
          .includes(q),
      );
    }
    return list;
  }, [
    feedBlogs,
    ownHandle,
    tab,
    topic,
    searchQuery,
    bookmarks.items,
    following.items,
    own.profile.name,
    own.profile.avatarUrl,
  ]);

  const page = visible.slice(0, shown);

  const hasMore = shown < visible.length;

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || isLoadingMore) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsLoadingMore(true);
        loadTimer.current = setTimeout(() => {
          setShown((n) => n + PAGE_SIZE); // TODO: replace with a real paginated fetch
          setIsLoadingMore(false);
        }, 500);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, isLoadingMore]);

  const changeTab = (t: Tab) => {
    setTab(t);
    setShown(PAGE_SIZE);
  };

  const changeTopic = (t: string) => {
    setTopic(t);
    setShown(PAGE_SIZE);
  };

  const changeSearch = (v: string) => {
    setSearchQuery(v);
    setShown(PAGE_SIZE);
  };

  const handleBookmark = (storyId: string, next: boolean) => {
    // Server-backed blogs go through the API; mock stories stay local
    if (isServerBlogId(storyId)) {
      setFeedBlogs((prev) =>
        prev.map((b) =>
          b.id === storyId ? { ...b, isBookmarked: next } : b,
        ),
      );
      bookmarkBlogApi(storyId, next)
        .then(() =>
          showToast(next ? "Saved to reading list" : "Removed from saved"),
        )
        .catch(() => {
          setFeedBlogs((prev) =>
            prev.map((b) =>
              b.id === storyId ? { ...b, isBookmarked: !next } : b,
            ),
          );
          showToast("Could not update bookmark");
        });
    } else {
      bookmarks.set(storyId, next);
      showToast(next ? "Saved to reading list" : "Removed from saved");
    }
  };

  // Own-blog actions from the card's 3-dots menu
  const handleEdit = (storyId: string) => navigate(`/write/${storyId}`);

  const handleDelete = (storyId: string) => {
    setFeedBlogs((prev) => prev.filter((b) => b.id !== storyId));
    deleteBlogApi(storyId)
      .then(() => showToast("Story deleted"))
      .catch(() => showToast("Could not delete the story"));
  };

  const toggleFollow = (handle: string) => {
    const on = !following.has(handle);
    following.set(handle, on);
    showToast(
      on
        ? `Following ${AUTHORS[handle].name}`
        : `Unfollowed ${AUTHORS[handle].name}`,
    );
  };

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = own.profile.name.split(" ")[0] || "there";

  const suggestions = Object.keys(AUTHORS)
    .filter((h) => h !== CURRENT_USER_HANDLE && !following.has(h))
    .slice(0, 3);
  const picks = STORIES.filter((s) => s.isStaffPick).slice(0, 3);

  const emptyState = searchQuery.trim() ? (
    <Empty
      title={`No stories match “${searchQuery.trim()}”`}
      body="Try a different word, or browse a topic instead."
    />
  ) : tab === "following" ? (
    <Empty
      title="Follow a few writers"
      body="Their new stories will show up here. Try the suggestions on the right, or switch to For you and follow someone."
    />
  ) : (
    <Empty
      title={`No stories in ${topic} yet`}
      body="Check back soon, or pick another topic."
    />
  );

  return (
    <AppShell searchQuery={searchQuery} onSearchChange={changeSearch}>
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#1B1F1C] px-4 py-2.5 text-[13px] font-medium text-white shadow-xl animate-fade-in"
        >
          {toast}
        </div>
      )}

      <main className="mx-auto max-w-270 px-4 sm:px-6 py-6 md:py-8 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 lg:gap-16">
        {/* Main column */}
        <div className="md:col-span-8 flex flex-col min-w-0">
          <h1 className="font-editorial text-[28px] sm:text-[32px] leading-tight text-[#1B1F1C] tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 mb-5 text-[15px] text-[#5C625E]">
            Pick up where your curiosity left off.
          </p>

          {/* Tabs */}
          <div
            role="tablist"
            className="mt-4 flex items-center gap-7 border-b border-[#E6E2D8]"
          >
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => changeTab(id)}
                className={`relative inline-flex items-center gap-1.5 pb-3 text-[15px] transition-colors ${
                  tab === id
                    ? "text-[#1F3D2F] font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#1F3D2F]"
                    : "text-[#5C625E] hover:text-[#1B1F1C]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Stories */}
          {visible.length === 0 ? (
            emptyState
          ) : (
            <div className="flex flex-col">
              {page.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  layout="list"
                  onBookmarkToggle={handleBookmark}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}

              {hasMore ? (
                <div
                  ref={sentinelRef}
                  className="py-8 flex justify-center"
                  aria-label="Loading more stories"
                >
                  <Loader2 className="w-5 h-5 animate-spin text-[#1F3D2F]" />
                </div>
              ) : (
                <p className="py-10 text-center text-[13px] text-[#8A8F8B]">
                  You’re all caught up.{" "}
                  <Link to="/write" className="text-[#1F3D2F] hover:underline">
                    Time to write something?
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: desktop only */}
        <aside className="hidden md:flex md:col-span-4 flex-col gap-8 md:sticky md:top-24 md:self-start md:pl-4">
          <section className="rounded-xl border border-[#E6E2D8] p-4">
            <h3 className="text-[13px] font-medium text-[#8A8F8B] mb-3">
              Today’s prompt
            </h3>
            <p className="font-editorial text-[18px] leading-snug text-[#1B1F1C]">
              What is something you stopped noticing this year?
            </p>
            <Link
              to="/write"
              className="mt-4 inline-flex h-8 items-center rounded-full bg-[#1F3D2F] px-4 text-[13px] font-medium text-white hover:bg-[#2A5240] transition-colors"
            >
              Write about this
            </Link>
          </section>

          <section>
            <h3 className="text-[13px] font-medium text-[#8A8F8B] mb-3">
              Who to follow
            </h3>
            {suggestions.length === 0 ? (
              <p className="text-[13px] text-[#8A8F8B]">
                You're following everyone here.
              </p>
            ) : (
              <ul className="space-y-3">
                {suggestions.map((h) => {
                  const a = AUTHORS[h];
                  return (
                    <li key={h} className="flex items-center gap-3">
                      <Link
                        to={`/u/${h}`}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <span
                          className={`w-8 h-8 shrink-0 rounded-full ${a.color} text-white font-editorial text-[13px] flex items-center justify-center`}
                        >
                          {a.name[0]}
                        </span>
                        <span className="min-w-0 leading-tight">
                          <span className="block text-[14px] font-medium text-[#1B1F1C] truncate">
                            {a.name}
                          </span>
                          <span className="block text-[12px] text-[#8A8F8B] truncate">
                            {a.bio}
                          </span>
                        </span>
                      </Link>
                      <FollowButton
                        following={false}
                        onClick={() => toggleFollow(h)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-[13px] font-medium text-[#8A8F8B] mb-3">
              Explore topics
            </h3>
            <div className="flex flex-wrap gap-2">
              {TOPICS.slice(1).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    changeTopic(t);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="inline-flex h-7 items-center rounded-full bg-[#EAE6DD] px-3.5 text-[12px] text-[#1B1F1C] hover:bg-[#DFDBD2] transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[13px] font-medium text-[#8A8F8B] mb-3">
              Best picks
            </h3>
            <ul className="space-y-3">
              {picks.map((s) => (
                <li key={s.id}>
                  <p className="font-editorial text-[15px] leading-snug text-[#1B1F1C]">
                    {s.title}
                  </p>
                  <Link
                    to={`/u/${s.author.handle!.slice(1)}`}
                    className="text-[12px] text-[#8A8F8B] hover:text-[#1F3D2F]"
                  >
                    {s.author.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </main>
    </AppShell>
  );
};

export default FeedPage;
