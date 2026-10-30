import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, Users, Loader2 } from "lucide-react";
import { AppShell } from "../../../components/layout/AppShell";
import { StoryCard } from "../../../components/ui/StoryCard";
import { useOwnProfile } from "../../profile/hooks/useOwnProfile";
import { useStoredSet } from "../../../hooks/useStoredSet";
import { DEFAULT_FOLLOWING } from "../../../data/mockProfiles";
import Empty  from "../components/Empty";
import FollowButton from "../components/FollowButton";
import {
  listFeedApi,
  listFollowingFeedApi,
  bookmarkBlogApi,
  deleteBlogApi,
} from "../../blog/api/blog.api";
import {
  setFollowApi,
  listSuggestionsApi,
  listFollowingApi,
} from "../../profile/api/profile.api";
import type { BlogResponseDTO } from "@quill/shared";
import type { Story } from "../../profile/types/story.types";
import { blogToStory, isServerBlogId } from "../../blog/lib/blog-story";

const PAGE_SIZE = 5;
// Server-side feed page size
const FEED_PAGE_SIZE = 20;

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
  // Live filter state — seeded from `?q=` so a search submitted from another
  // page's navbar ("Enter" jumps to /feed?q=…) opens pre-filtered
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const own = useOwnProfile();

  // Server feed state for "For you" tab
  const [feedBlogs, setFeedBlogs] = useState<BlogResponseDTO[]>([]);
  const [feedPage, setFeedPage] = useState(1);
  const [feedTotal, setFeedTotal] = useState<number | null>(null);
  const [serverDown, setServerDown] = useState(false);

  // Following feed state for "Following" tab
  const [followingBlogs, setFollowingBlogs] = useState<BlogResponseDTO[]>([]);
  const [followingPage, setFollowingPage] = useState(1);
  const [followingTotal, setFollowingTotal] = useState<number | null>(null);
  const [followingServerDown, setFollowingServerDown] = useState(false);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<
    Array<{
      id: string;
      name: string;
      handle: string | null;
      avatar: string | null;
      bio: string | null;
      followers: number;
    }>
  >([]);

  // Shared follow cache — ProfilePage and FollowersModal write to the same
  // key, so a handle in here is followed and tapping it unfollows
  const following = useStoredSet("quill_following", DEFAULT_FOLLOWING);
  // Follow requests in flight — blocks double taps that could settle
  // out of order (overlapping follow/unfollow requests)
  const [pendingFollows, setPendingFollows] = useState<string[]>([]);
  const pendingFollowsRef = useRef<Set<string>>(new Set());

  const fetchFeedPage = useCallback(
    async (
      targetPage: number,
    ): Promise<{ items: BlogResponseDTO[]; total: number } | null> => {
      try {
        const res = await listFeedApi(targetPage, FEED_PAGE_SIZE);
        return res;
      } catch {
        return null;
      }
    },
    [],
  );

  const fetchFollowingFeedPage = useCallback(
    async (
      targetPage: number,
    ): Promise<{ items: BlogResponseDTO[]; total: number } | null> => {
      try {
        const res = await listFollowingFeedApi(targetPage, FEED_PAGE_SIZE);
        return res;
      } catch {
        return null;
      }
    },
    [],
  );

  // Initial load for "For you" feed
  useEffect(() => {
    let cancelled = false;
    fetchFeedPage(1).then((res) => {
      if (cancelled) return;
      if (res) {
        setFeedBlogs(res.items);
        setFeedTotal(res.total);
        setServerDown(false);
      } else {
        setServerDown(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fetchFeedPage]);

  // Initial load for "Following" feed
  useEffect(() => {
    let cancelled = false;
    fetchFollowingFeedPage(1).then((res) => {
      if (cancelled) return;
      if (res) {
        setFollowingBlogs(res.items);
        setFollowingTotal(res.total);
        setFollowingServerDown(false);
      } else {
        setFollowingServerDown(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fetchFollowingFeedPage]);

  // Load suggestions
  useEffect(() => {
    let cancelled = false;
    listSuggestionsApi(5).then((res) => {
      if (!cancelled) setSuggestions(res);
    }).catch(() => {
      // Silently fail - suggestions are optional
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reconcile the local follow cache with server truth once on mount, so a
  // suggestion the user already follows shows "Following" (and a tap on it
  // unfollows) instead of trusting a possibly stale localStorage set
  useEffect(() => {
    let cancelled = false;
    listFollowingApi()
      .then((users) => {
        if (cancelled) return;
        following.replace(
          users.map((u) => u.handle).filter((h): h is string => Boolean(h)),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Append the next server page for "For you"
  const loadMoreServer = useCallback(async () => {
    if (serverDown || feedTotal === null) return;
    const nextPage = feedPage + 1;
    if (feedPage * FEED_PAGE_SIZE >= feedTotal) return;

    const res = await fetchFeedPage(nextPage);
    if (res) {
      setFeedBlogs((prev) => [...prev, ...res.items]);
      setFeedTotal(res.total);
      setFeedPage(nextPage);
    } else {
      setServerDown(true);
    }
  }, [feedPage, feedTotal, serverDown, fetchFeedPage]);

  // Append the next server page for "Following"
  const loadMoreFollowingServer = useCallback(async () => {
    if (followingServerDown || followingTotal === null) return;
    const nextPage = followingPage + 1;
    if (followingPage * FEED_PAGE_SIZE >= followingTotal) return;

    const res = await fetchFollowingFeedPage(nextPage);
    if (res) {
      setFollowingBlogs((prev) => [...prev, ...res.items]);
      setFollowingTotal(res.total);
      setFollowingPage(nextPage);
    } else {
      setFollowingServerDown(true);
    }
  }, [followingPage, followingTotal, followingServerDown, fetchFollowingFeedPage]);

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

  const ownHandle = own.profile.handle ?? "";

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    // Select the right feed based on tab
    const currentFeedBlogs = tab === "following" ? followingBlogs : feedBlogs;

    // Server feed first; no mock fallback
    let list: Story[] = currentFeedBlogs.map((b) =>
      blogToStory(b, ownHandle),
    );

    if (topic !== "All") list = list.filter((s) => s.topic === topic);

    if (q) {
      list = list.filter((s) =>
        `${s.title} ${s.excerpt} ${s.author.name} ${s.author.handle ?? ""} ${s.topic} ${s.content ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    return list;
  }, [
    feedBlogs,
    followingBlogs,
    ownHandle,
    tab,
    topic,
    searchQuery,
  ]);

  const page = visible.slice(0, shown);

  // More server pages exist
  const currentTotal = tab === "following" ? followingTotal : feedTotal;
  const hasMore = currentTotal
    ? (tab === "following" ? followingPage : feedPage) * FEED_PAGE_SIZE <
      currentTotal
    : false;

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || isLoadingMore) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsLoadingMore(true);
        if (tab === "following") {
          loadMoreFollowingServer().finally(() => {
            loadTimer.current = setTimeout(
              () => setIsLoadingMore(false),
              500,
            );
          });
        } else {
          loadMoreServer().finally(() => {
            loadTimer.current = setTimeout(
              () => setIsLoadingMore(false),
              500,
            );
          });
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [
    hasMore,
    isLoadingMore,
    loadMoreServer,
    loadMoreFollowingServer,
    tab,
  ]);

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
    const next = new URLSearchParams(searchParams);
    if (v) next.set("q", v);
    else next.delete("q");
    setSearchParams(next, { replace: true });
    setShown(PAGE_SIZE);
  };

  const handleBookmark = (storyId: string, next: boolean) => {
    if (isServerBlogId(storyId)) {
      // Update the correct feed
      if (tab === "following") {
        setFollowingBlogs((prev) =>
          prev.map((b) => (b.id === storyId ? { ...b, isBookmarked: next } : b)),
        );
      } else {
        setFeedBlogs((prev) =>
          prev.map((b) => (b.id === storyId ? { ...b, isBookmarked: next } : b)),
        );
      }
      bookmarkBlogApi(storyId, next)
        .then(() =>
          showToast(next ? "Saved to reading list" : "Removed from saved"),
        )
        .catch(() => {
          // Revert on failure
          if (tab === "following") {
            setFollowingBlogs((prev) =>
              prev.map((b) =>
                b.id === storyId ? { ...b, isBookmarked: !next } : b,
              ),
            );
          } else {
            setFeedBlogs((prev) =>
              prev.map((b) =>
                b.id === storyId ? { ...b, isBookmarked: !next } : b,
              ),
            );
          }
          showToast("Could not update bookmark");
        });
    }
  };

  // Own-blog actions from the card's 3-dots menu
  const handleEdit = (storyId: string) => navigate(`/write/${storyId}`);

  const handleDelete = (storyId: string) => {
    setFeedBlogs((prev) => prev.filter((b) => b.id !== storyId));
    setFollowingBlogs((prev) => prev.filter((b) => b.id !== storyId));
    deleteBlogApi(storyId)
      .then(() => showToast("Story deleted"))
      .catch(() => showToast("Could not delete the story"));
  };

  // Follow/unfollow from "Who to follow". The direction MUST come from the
  // shared follow cache, not from suggestions membership — suggestions can
  // include writers the user already follows, which made the old
  // `!suggestions.some(...)` check invert every tap into an unfollow.
  const toggleFollow = async (handle: string) => {
    if (!handle) return;
    // Ignore taps while this writer already has a request in flight —
    // overlapping follow/unfollow calls can settle out of order
    if (pendingFollowsRef.current.has(handle)) return;
    const on = !following.has(handle);
    pendingFollowsRef.current.add(handle);
    setPendingFollows((prev) => [...prev, handle]);
    // Optimistic: flip the cache immediately so the button label matches the tap
    following.set(handle, on);
    try {
      const result = await setFollowApi(handle, on);
      // Settle the cache to the server's authoritative answer
      following.set(result.handle ?? handle, result.isFollowing);
      showToast(
        result.isFollowing
          ? `Following ${suggestions.find((s) => s.handle === handle)?.name ?? handle}`
          : `Unfollowed ${suggestions.find((s) => s.handle === handle)?.name ?? handle}`,
      );
      // Refresh suggestions after follow/unfollow
      listSuggestionsApi(5).then(setSuggestions).catch(() => {});
      // The already-loaded Following feed knows nothing about this follow —
      // re-fetch page 1 so the new followee's stories appear right away
      fetchFollowingFeedPage(1).then((res) => {
        if (!res) return;
        setFollowingBlogs(res.items);
        setFollowingTotal(res.total);
        setFollowingPage(1);
        setFollowingServerDown(false);
      });
    } catch {
      // Revert the optimistic change on failure
      following.set(handle, !on);
      showToast("Could not update follow");
    } finally {
      pendingFollowsRef.current.delete(handle);
      setPendingFollows((prev) => prev.filter((h) => h !== handle));
    }
  };

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = own.profile.name.split(" ")[0] || "there";

  const emptyState = searchQuery.trim() ? (
    <Empty
      title={`No stories match "${searchQuery.trim()}"`}
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
                  You're all caught up.{" "}
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
              Today's prompt
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
                No suggestions available right now.
              </p>
            ) : (
              <ul className="space-y-3">
                {suggestions.map((s) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <Link
                      to={`/${s.handle}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <span
                        className={`w-8 h-8 shrink-0 rounded-full bg-[#1F3D2F]/10 text-[#1F3D2F] font-editorial text-[13px] flex items-center justify-center`}
                      >
                        {s.name[0]}
                      </span>
                      <span className="min-w-0 leading-tight">
                        <span className="block text-[14px] font-medium text-[#1B1F1C] truncate">
                          {s.name}
                        </span>
                        <span className="block text-[12px] text-[#8A8F8B] truncate">
                          {s.bio ?? "Writer on Quill"}
                        </span>
                      </span>
                    </Link>
                    <FollowButton
                      following={following.has(s.handle ?? "")}
                      disabled={pendingFollows.includes(s.handle ?? "")}
                      onClick={() => void toggleFollow(s.handle ?? "")}
                    />
                  </li>
                ))}
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
        </aside>
      </main>
    </AppShell>
  );
};

export default FeedPage;