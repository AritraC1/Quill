import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { BlogCountDTO, PublicProfileDTO } from "@quill/shared";
import { AppShell } from "../../../components/layout/AppShell";
import { StoryCard } from "../../../components/ui/StoryCard";
import { useStoredSet } from "../../../hooks/useStoredSet";
import {
  DEFAULT_SAVED,
  DEFAULT_FOLLOWING,
  type Author,
  type Draft,
} from "../../../data/mockProfiles";
import {
  blogCountApi,
  bookmarkBlogApi,
  deleteBlogApi,
  listAuthorBlogsApi,
  listBookmarksApi,
  listDraftsApi,
  listMyPublishedApi,
} from "../../blog/api/blog.api";
import {
  getProfileByHandleApi,
  listFollowingApi,
  setFollowApi,
} from "../api/profile.api";
import { assetUrl } from "../../auth/api/auth.api";
import { blogToDraft, blogToStory, isServerBlogId } from "../../blog/lib/blog-story";
import type { BlogResponseDTO } from "@quill/shared";
import type { Story } from "../types/story.types";
import EmptyState from "../components/EmptyState";
import ProfileMenu from "../components/ProfileMenu";
import DraftRow from "../components/DraftRow";
import FollowersModal from "../components/FollowersModal";
import type { Tab } from "../types/tab.types";
import { useOwnProfile } from "../hooks/useOwnProfile";

const OWN_TABS: { id: Tab; label: string }[] = [
  { id: "stories", label: "Stories" },
  { id: "drafts", label: "Drafts" },
  { id: "saved", label: "Saved" },
];

const VISITOR_TABS = OWN_TABS.filter((t) => t.id === "stories");

const ProfileView = () => {
  const { handle } = useParams<{ handle?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile: own, loading } = useOwnProfile();

  // Own profile: the real (server-generated) handle; visitors come via /<handle>
  const ownHandle = own.handle;
  const navigate = useNavigate();
  const isOwn = handle === undefined || handle === ownHandle;
  const profileHandle = isOwn ? ownHandle : handle ?? ownHandle;

  const bookmarks = useStoredSet("quill_bookmarks", DEFAULT_SAVED);
  const following = useStoredSet("quill_following", DEFAULT_FOLLOWING);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [followersOpen, setFollowersOpen] = useState(false);
  // Follow request in flight — the button stays disabled until it settles
  const [followPending, setFollowPending] = useState(false);

  const tabs = isOwn ? OWN_TABS : VISITOR_TABS;
  const requested = searchParams.get("tab");
  const activeTab: Tab = tabs.find((t) => t.id === requested)?.id ?? "stories";
  const setTab = (t: Tab) =>
    setSearchParams(t === "stories" ? {} : { tab: t }, { replace: true });

  // ---- Blogs from the API ----
  const [ownBlogDtos, setOwnBlogDtos] = useState<BlogResponseDTO[]>([]);
  const [ownBlogsTotal, setOwnBlogsTotal] = useState(0);
  const [serverDrafts, setServerDrafts] = useState<Draft[]>([]);
  const [savedBlogDtos, setSavedBlogDtos] = useState<BlogResponseDTO[]>([]);
  const [blogCount, setBlogCount] = useState<BlogCountDTO | null>(null);
  const [followingUsers, setFollowingUsers] = useState<
    Array<{ id: string; name: string; handle: string | null; avatar: string | null }>
  >([]);

  // ---- Visitor profile via the API (was mock AUTHORS data) ----
  const [visitorProfile, setVisitorProfile] = useState<PublicProfileDTO | null>(
    null,
  );
  const [visitorNotFound, setVisitorNotFound] = useState(false);
  const [visitorBlogDtos, setVisitorBlogDtos] = useState<BlogResponseDTO[]>([]);
  const [visitorBlogsTotal, setVisitorBlogsTotal] = useState(0);
  const [profilePage, setProfilePage] = useState(1);

  // Server profile for visitors → same shape the own-profile hook produces
  const visitorAuthor: Author | null = visitorProfile
    ? {
        name: visitorProfile.name,
        handle: visitorProfile.handle,
        bio: visitorProfile.bio ?? "",
        followers: visitorProfile.followers,
        following: 0,
        website: visitorProfile.website ?? undefined,
        avatarUrl: visitorProfile.avatar ?? undefined,
        topics: visitorProfile.favGenre,
        color: "bg-[#B27D56]",
        joined: new Date(visitorProfile.createdAt).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
      }
    : null;
  const author = isOwn ? own : visitorAuthor;

  useEffect(() => {
    if (!isOwn) return;
    let cancelled = false;

    // writer statistics: number of blogs published / in draft
    blogCountApi()
      .then((count) => {
        if (!cancelled) setBlogCount(count);
      })
      .catch(() => {});
    listMyPublishedApi()
      .then((res) => {
        if (!cancelled) {
          setOwnBlogDtos(res.items);
          setOwnBlogsTotal(res.total);
          setProfilePage(1);
        }
      })
      .catch(() => {});
    listDraftsApi()
      .then((res) => {
        if (!cancelled) setServerDrafts(res.items.map(blogToDraft));
      })
      .catch(() => {});
    listBookmarksApi()
      .then((res) => {
        if (!cancelled) setSavedBlogDtos(res.items);
      })
      .catch(() => {});
    // Real data for the "Following" sidebar (was mock AUTHORS lookups)
    listFollowingApi()
      .then((users) => {
        if (!cancelled) setFollowingUsers(users);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOwn, activeTab]);

  useEffect(() => {
    if (isOwn) return;
    let cancelled = false;
    setVisitorNotFound(false);

    getProfileByHandleApi(profileHandle)
      .then((profile) => {
        if (!cancelled) setVisitorProfile(profile);
      })
      .catch(() => {
        if (!cancelled) setVisitorNotFound(true);
      });
    listAuthorBlogsApi(profileHandle)
      .then((res) => {
        if (!cancelled) {
          setVisitorBlogDtos(res.items);
          setVisitorBlogsTotal(res.total);
          setProfilePage(1);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOwn, profileHandle]);

  // Twitter-style canonical URL — the profile lives at /<handle>.
  // Bare /profile, legacy /u/<own-handle>, or the own handle all forward to it.
  // Wait for the real profile first so the redirect uses the server handle.
  const { pathname, search } = useLocation();
  // Wait for the real profile before rendering (and before the canonical
  // redirect pulls the server handle) — unless the handle is already cached
  // locally, in which case the page can show immediately
  if (loading && !ownHandle) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-[14px] text-[#8A8F8B]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading profile…
        </div>
      </AppShell>
    );
  }

  if (isOwn && ownHandle && pathname !== `/${ownHandle}`) {
    return <Navigate to={`/${ownHandle}${search}`} replace />;
  }

  // Not found / still loading
  if (!author) {
    if (!isOwn && visitorNotFound) {
      return (
        <AppShell>
          <div className="mx-auto max-w-270 px-4 py-24 text-center">
            <EmptyState
              title="We couldn’t find that author"
              body="The profile may have moved, or the link may be wrong."
              ctaLabel="Back to your feed"
              ctaTo="/feed"
            />
          </div>
        </AppShell>
      );
    }
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-[14px] text-[#8A8F8B]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading profile…
        </div>
      </AppShell>
    );
  }

  // Live navbar search (`?q=` from AppShell) narrows the visible stories
  // by title, excerpt or author name
  const searchQuery = (searchParams.get("q") ?? "").trim().toLowerCase();
  const matchesQuery = (s: Story) => {
    if (!searchQuery) return true;
    return (
      s.title.toLowerCase().includes(searchQuery) ||
      s.excerpt.toLowerCase().includes(searchQuery) ||
      s.author.name.toLowerCase().includes(searchQuery) ||
      (s.author.handle ?? "").toLowerCase().includes(searchQuery) ||
      (s.content ?? "").toLowerCase().includes(searchQuery)
    );
  };

  const publishedStories = (isOwn
    ? ownBlogDtos.map((b) => blogToStory(b, ownHandle))
    : visitorBlogDtos.map((b) => blogToStory(b, ownHandle))
  ).filter(matchesQuery);
  const savedStories = savedBlogDtos
    .map((b) => blogToStory(b, ownHandle))
    .filter(matchesQuery);

  const isFollowing = isOwn
    ? following.has(profileHandle)
    : (visitorProfile?.isFollowing ?? false);
  // Follower count is backend-sourced (getMe returns it), so it stays correct
  // when someone follows you — no local optimistic math needed.
  const followerCount = author.followers;

  const handleBookmark = (storyId: string, next: boolean) => {
    // Server-backed blogs go through the API; mock stories stay local
    if (isServerBlogId(storyId)) {
      // optimistic update, reverted on failure
      const apply = (nextState: boolean) => {
        setOwnBlogDtos((prev) =>
          prev.map((b) =>
            b.id === storyId ? { ...b, isBookmarked: nextState } : b,
          ),
        );
        setSavedBlogDtos((prev) =>
          nextState
            ? prev.some((b) => b.id === storyId)
              ? prev
              : [...prev, ...ownBlogDtos.filter((b) => b.id === storyId)]
            : prev.filter((b) => b.id !== storyId),
        );
      };
      apply(next);
      bookmarkBlogApi(storyId, next)
        .then(() =>
          toast(next ? "Saved to reading list" : "Removed from saved", {
            id: "bookmark",
          }),
        )
        .catch(() => {
          apply(!next);
          toast.error("Could not update bookmark");
        });
    } else {
      bookmarks.set(storyId, next);
      toast(next ? "Saved to reading list" : "Removed from saved", {
        id: "bookmark", // a rapid second tap replaces the toast instead of stacking
      });
    }
  };

  // Own-blog actions from the card's 3-dots menu
  const handleEdit = (storyId: string) => navigate(`/write/${storyId}`);

  const handleDelete = (storyId: string) => {
    setOwnBlogDtos((prev) => prev.filter((b) => b.id !== storyId));
    setSavedBlogDtos((prev) => prev.filter((b) => b.id !== storyId));
    deleteBlogApi(storyId)
      .then(() => toast("Story deleted"))
      .catch(() => toast.error("Could not delete the story"));
  };

  // Real follow/unfollow through the API — optimistic button, server truth on settle
  const handleFollow = () => {
    // One request at a time: rapid taps would send overlapping
    // follow/unfollow calls and could settle the button out of order
    if (followPending) return;
    const next = !isFollowing;
    if (isOwn) {
      // own view never renders the button; defensive local toggle only
      following.set(profileHandle, next);
      return;
    }
    setFollowPending(true);
    // Keep the shared `quill_following` set in sync so the feed's Following
    // tab immediately shows this writer's blogs
    following.set(profileHandle, next);

    const previousProfile = visitorProfile;
    setVisitorProfile(
      previousProfile
        ? { ...previousProfile, isFollowing: next, followers: previousProfile.followers + (next ? 1 : -1) }
        : previousProfile,
    );
    setFollowApi(profileHandle, next)
      .then((result) =>
        setVisitorProfile((prev) =>
          prev ? { ...prev, isFollowing: result.isFollowing, followers: result.followers } : prev,
        ),
      )
      .then(() =>
        toast(next ? `Following ${author.name}` : `Unfollowed ${author.name}`, {
          id: "follow", // a rapid second tap replaces the toast instead of stacking
        }),
      )
      .catch(() => {
        setVisitorProfile(previousProfile);
        // Revert the optimistic local-storage update too — the server stays
        // authoritative, but the cached set must not be left stale
        following.set(profileHandle, !next);
        toast.error("Could not update follow");
      })
      .finally(() => setFollowPending(false));
  };

  const handleDeleteDraft = (id: string) => {
    setConfirmId(null);
    setServerDrafts((prev) => prev.filter((d) => d.id !== id));
    deleteBlogApi(id)
      .then(() => toast("Draft deleted"))
      .catch(() => toast.error("Could not delete draft"));
  };

  const PAGE_SIZE = 20;

  // Real pagination for the Stories tab — own profile or the visitor's
  const handleLoadMore = () => {
    setIsLoadingMore(true);
    const next = profilePage + 1;
    const fetch = isOwn
      ? listMyPublishedApi(next, PAGE_SIZE)
      : listAuthorBlogsApi(profileHandle, next, PAGE_SIZE);
    fetch
      .then((res) => {
        const apply = (
          setter: React.Dispatch<React.SetStateAction<BlogResponseDTO[]>>,
        ) =>
          setter((prev) => [
            ...prev,
            ...res.items.filter((b) => !prev.some((p) => p.id === b.id)),
          ]);
        if (isOwn) {
          apply(setOwnBlogDtos);
          setOwnBlogsTotal(res.total);
        } else {
          apply(setVisitorBlogDtos);
          setVisitorBlogsTotal(res.total);
        }
        setProfilePage(next);
      })
      .catch(() => toast.error("Could not load more stories"))
      .finally(() => setIsLoadingMore(false));
  };

  const hasMoreStories = isOwn
    ? ownBlogDtos.length < ownBlogsTotal
    : visitorBlogDtos.length < visitorBlogsTotal;

  const renderStories = (
    list: typeof publishedStories,
    empty: React.ReactNode,
  ) =>
    list.length === 0 ? (
      empty
    ) : (
      <div className="flex flex-col">
        {list.map((story) => (
          <StoryCard
            key={story.id}
            story={story}
            hideAuthor
            onBookmarkToggle={handleBookmark}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>
    );

  return (
    <AppShell>
      <main className="mx-auto max-w-270 px-4 sm:px-6 py-6 md:py-8 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 lg:gap-16">
        {/* Sidebar: first on mobile (order-1), right column on desktop */}
        <aside className="order-1 md:order-2 md:col-span-4 md:sticky md:top-24 md:self-start md:pl-4">
          <div className="flex items-center gap-4 md:block">
            <div className="relative shrink-0 w-16 h-16 md:w-24 md:h-24 md:mb-5">
              {author.avatarUrl ? (
                <img
                  src={assetUrl(author.avatarUrl)}
                  alt={`${author.name}’s photo`}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div
                  className={`w-full h-full rounded-full ${author.color} text-white font-editorial text-2xl md:text-4xl flex items-center justify-center select-none`}
                >
                  {author.name[0]}
                </div>
              )}
              <span className="absolute bottom-0 right-0 md:bottom-1 md:right-1 flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-[#4E9F76] text-white ring-2 ring-[#F6F3EC]">
                <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-editorial text-[24px] md:font-['Inter',sans-serif] md:text-[17px] md:font-semibold text-[#1B1F1C] truncate">
                {author.name}
              </h2>
              <p className="mt-0.5">
                <button
                  type="button"
                  onClick={() => setFollowersOpen(true)}
                  className="text-[13px] text-[#8A8F8B] underline-offset-2 hover:text-[#1B1F1C] hover:underline transition-colors"
                >
                  {followerCount.toLocaleString()} Followers
                </button>
              </p>
              {isOwn && blogCount && (
                <p className="text-[13px] text-[#8A8F8B] mt-0.5">
                  {blogCount.published} published · {blogCount.drafts} drafts
                </p>
              )}
            </div>

            <div className="md:hidden">
              <ProfileMenu isOwn={isOwn} name={author.name} handle={profileHandle} />
            </div>
          </div>

          {author.bio?.trim() ? (
            <p className="mt-4 md:mt-3.5 text-[14px] leading-5.5 text-[#5C625E]">
              {author.bio}
            </p>
          ) : null}

          {author.website && (
            <a
              href={author.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block truncate text-[13px] text-[#1F3D2F] hover:underline"
            >
              {author.website.replace(/^https?:\/\//, "")}
            </a>
          )}

          {isOwn ? (
            <Link
              to="/profile/edit"
              className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-[#1F3D2F] px-4 text-[13px] font-medium text-[#1F3D2F] hover:bg-[#1F3D2F]/5 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit profile
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleFollow}
              disabled={followPending}
              aria-pressed={isFollowing}
              className={`mt-4 h-8 rounded-full px-4 text-[13px] font-medium border transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isFollowing
                  ? "border-[#1F3D2F] text-[#1F3D2F] hover:bg-[#1F3D2F]/5"
                  : "border-[#1F3D2F] bg-[#1F3D2F] text-white hover:bg-[#2A5240]"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          )}

          <div className="my-6 md:my-7 border-t border-[#E6E2D8]" />

          <div>
            <h3 className="text-[13px] font-medium text-[#8A8F8B] mb-3">
              Topics
            </h3>
            <div className="flex flex-wrap gap-2">
              {author.topics.map((t) => (
                <Link
                  key={t}
                  to={`/topic/${t.toLowerCase()}`}
                  className="inline-flex items-center rounded-full bg-[#EAE6DD] px-3.5 py-1.5 text-[12px] text-[#1B1F1C] hover:bg-[#DFDBD2] transition-colors"
                >
                  {t}
                </Link>
              ))}
            </div>
          </div>

          {/* Following list: your own profile only, desktop only */}
          {isOwn && (
            <div className="hidden md:block">
              <div className="my-7 border-t border-[#E6E2D8]" />
              <h3 className="text-[13px] font-medium text-[#8A8F8B] mb-3.5">
                Following
              </h3>
              {followingUsers.length === 0 ? (
                <p className="text-[13px] text-[#8A8F8B]">
                  You aren’t following anyone yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {followingUsers.slice(0, 5).map((u) => (
                    <li key={u.id}>
                      <Link
                        to={u.handle ? `/${u.handle}` : "/feed"}
                        className="flex items-center gap-3 text-[14px] text-[#1B1F1C] hover:text-[#1F3D2F] transition-colors"
                      >
                        {assetUrl(u.avatar) ? (
                          <img
                            src={assetUrl(u.avatar)}
                            alt={u.name}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-[#B27D56] text-white flex items-center justify-center text-xs font-medium">
                            {u.name[0]}
                          </span>
                        )}
                        <span>{u.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {followingUsers.length > 5 && (
                <button
                  type="button"
                  className="mt-4 text-[13px] text-[#1F3D2F] hover:underline"
                >
                  See all {followingUsers.length}
                </button>
              )}
            </div>
          )}
        </aside>

        {/* Main column */}
        <div className="order-2 md:order-1 md:col-span-8 flex flex-col min-w-0">
          <div className="hidden md:flex items-center justify-between pb-6">
            <h1 className="font-editorial text-[42px] font-normal text-[#1B1F1C] tracking-tight">
              {author.name}
            </h1>
            <ProfileMenu isOwn={isOwn} name={author.name} handle={profileHandle} />
          </div>

          <div
            role="tablist"
            className="flex items-center gap-7 border-b border-[#E6E2D8] mb-2 overflow-x-auto"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setTab(t.id)}
                className={`relative shrink-0 pb-3 text-[15px] transition-colors ${
                  activeTab === t.id
                    ? "text-[#1F3D2F] font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#1F3D2F]"
                    : "text-[#5C625E] hover:text-[#1B1F1C]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === "stories" && (
            <>
              {renderStories(
                publishedStories,
                searchQuery && publishedStories.length === 0 ? (
                  <EmptyState
                    title={`No results for “${searchQuery}”`}
                    body="Nothing here matches your search — try another word, or clear it in the navbar."
                  />
                ) : isOwn ? (
                  <EmptyState
                    title="You haven’t published anything yet"
                    body="Your published stories will appear here."
                    ctaLabel="Write your first story"
                    ctaTo="/write"
                  />
                ) : (
                  <EmptyState
                    title="No stories yet"
                    body={`${author.name} hasn’t published anything yet.`}
                  />
                ),
              )}

              {hasMoreStories && publishedStories.length > 0 && (
                <div className="py-10 flex justify-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="rounded-full border border-[#E6E2D8] bg-white px-6 py-2 text-[13px] font-medium text-[#1B1F1C] hover:bg-[#F0EDE4] hover:border-[#8A8F8B] transition-colors disabled:opacity-50"
                  >
                    {isLoadingMore ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#1F3D2F]" />
                        Loading…
                      </span>
                    ) : (
                      "Load more"
                    )}
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === "drafts" && isOwn && (
            <div>
              <div className="py-2 text-[13px] text-[#8A8F8B]">
                <span>Only you can see your drafts.</span>
              </div>
              {serverDrafts.length === 0 ? (
                <EmptyState
                  title="No drafts"
                  body="Anything you start writing is saved here until you publish it."
                  ctaLabel="Start writing"
                  ctaTo="/write"
                />
              ) : (
                serverDrafts.map((d) => (
                  <DraftRow
                    key={d.id}
                    draft={d}
                    confirming={confirmId === d.id}
                    onAskDelete={() => setConfirmId(d.id)}
                    onCancel={() => setConfirmId(null)}
                    onDelete={() => handleDeleteDraft(d.id)}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === "saved" &&
            isOwn &&
            renderStories(
              savedStories,
              searchQuery && savedStories.length === 0 ? (
                <EmptyState
                  title={`No results for “${searchQuery}”`}
                  body="No saved stories match your search — clear it in the navbar to see everything."
                />
              ) : (
                <EmptyState
                  title="Nothing saved yet"
                  body="Tap the bookmark on any story to keep it here for later."
                  ctaLabel="Browse stories"
                  ctaTo="/feed"
                />
              ),
            )}
        </div>
      </main>

      {/* Followers modal — opens from the follower count under the name */}
      <FollowersModal
        open={followersOpen}
        onClose={() => setFollowersOpen(false)}
        name={author.name}
        handle={profileHandle}
        isOwn={isOwn}
      />
    </AppShell>
  );
};

export const ProfilePage = () => {
  const { handle } = useParams<{ handle?: string }>();
  return <ProfileView key={handle ?? "me"} />;
};

export default ProfilePage;