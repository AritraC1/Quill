import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { BlogCountDTO } from "@quill/shared";
import { AppShell } from "../../../components/layout/AppShell";
import { StoryCard } from "../../../components/ui/StoryCard";
import { useStoredSet } from "../../../hooks/useStoredSet";
import {
  ALL_STORIES,
  AUTHORS,
  CURRENT_USER_HANDLE,
  DEFAULT_SAVED,
  DEFAULT_FOLLOWING,
  type Draft,
} from "../../../data/mockProfiles";
import {
  blogCountApi,
  bookmarkBlogApi,
  deleteBlogApi,
  listBookmarksApi,
  listDraftsApi,
  listMyPublishedApi,
} from "../../blog/api/blog.api";
import { blogToDraft, blogToStory, isServerBlogId } from "../../blog/lib/blog-story";
import type { BlogResponseDTO } from "@quill/shared";
import type { Story } from "../types/story.types";
import EmptyState from "../components/EmptyState";
import ProfileMenu from "../components/ProfileMenu";
import DraftRow from "../components/DraftRow";
import type { Tab } from "../types/tab.types";
import { useOwnProfile } from "../hooks/useOwnProfile";

const OWN_TABS: { id: Tab; label: string }[] = [
  { id: "stories", label: "Stories" },
  { id: "drafts", label: "Drafts" },
  { id: "saved", label: "Saved" },
  { id: "about", label: "About" },
];

const VISITOR_TABS = OWN_TABS.filter(
  (t) => t.id === "stories" || t.id === "about",
);

const ProfileView = () => {
  const { handle } = useParams<{ handle?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const own = useOwnProfile();

  // Own profile: the real (server-generated) handle; visitors come via /u/:handle
  const ownHandle = own.profile.handle ?? CURRENT_USER_HANDLE;
  const navigate = useNavigate();
  const isOwn = handle === undefined || handle === ownHandle;
  const profileHandle = isOwn ? ownHandle : handle ?? ownHandle;
  const author = isOwn ? own.profile : AUTHORS[profileHandle];

  const bookmarks = useStoredSet("quill_bookmarks", DEFAULT_SAVED);
  const following = useStoredSet("quill_following", DEFAULT_FOLLOWING);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const tabs = isOwn ? OWN_TABS : VISITOR_TABS;
  const requested = searchParams.get("tab");
  const activeTab: Tab = tabs.find((t) => t.id === requested)?.id ?? "stories";
  const setTab = (t: Tab) =>
    setSearchParams(t === "stories" ? {} : { tab: t }, { replace: true });

  // ---- Blogs from the API (own profile only; visitors still see mock data) ----
  const [ownBlogDtos, setOwnBlogDtos] = useState<BlogResponseDTO[]>([]);
  const [serverDrafts, setServerDrafts] = useState<Draft[]>([]);
  const [savedBlogDtos, setSavedBlogDtos] = useState<BlogResponseDTO[]>([]);
  const [blogCount, setBlogCount] = useState<BlogCountDTO | null>(null);

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
        if (!cancelled) setOwnBlogDtos(res.items);
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

    return () => {
      cancelled = true;
    };
  }, [isOwn, activeTab]);

  // /u/<own-handle> is the same page as /profile — canonicalize
  if (handle && isOwn) return <Navigate to="/profile" replace />;

  if (!author) {
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

  const withSaved = (list: Story[]) =>
    list.map((s) => ({
      ...s,
      isBookmarked: bookmarks.has(s.id),
      author:
        s.author.handle === `@${CURRENT_USER_HANDLE}`
          ? {
              ...s.author,
              name: own.profile.name,
              avatar: own.profile.avatarUrl ?? s.author.avatar,
            }
          : s.author,
    }));

  const publishedStories = isOwn
    ? ownBlogDtos.map((b) => blogToStory(b, ownHandle))
    : withSaved(ALL_STORIES.filter((s) => s.author.handle === `@${profileHandle}`));
  const savedStories = isOwn
    ? savedBlogDtos.map((b) => blogToStory(b, ownHandle))
    : withSaved(ALL_STORIES.filter((s) => bookmarks.has(s.id)));

  const isFollowing = following.has(profileHandle);
  const followerCount = author.followers + (isFollowing ? 1 : 0);

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

  const handleFollow = () => {
    following.set(profileHandle, !isFollowing);
    toast(
      isFollowing ? `Unfollowed ${author.name}` : `Following ${author.name}`,
      { id: "follow" },
    );
  };

  const handleDeleteDraft = (id: string) => {
    setConfirmId(null);
    setServerDrafts((prev) => prev.filter((d) => d.id !== id));
    deleteBlogApi(id)
      .then(() => toast("Draft deleted"))
      .catch(() => toast.error("Could not delete draft"));
  };

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => setIsLoadingMore(false), 800); // TODO: wire to pagination
  };

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
                  src={author.avatarUrl}
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
              <p className="text-[13px] text-[#8A8F8B] mt-0.5">
                {followerCount.toLocaleString()} Followers
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
              aria-pressed={isFollowing}
              className={`mt-4 h-8 rounded-full px-4 text-[13px] font-medium border transition-colors ${
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
              {following.items.length === 0 ? (
                <p className="text-[13px] text-[#8A8F8B]">
                  You aren’t following anyone yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {following.items
                    .filter((h) => AUTHORS[h])
                    .slice(0, 5)
                    .map((h) => {
                      const a = AUTHORS[h];
                      return (
                        <li key={h}>
                          <Link
                            to={`/u/${h}`}
                            className="flex items-center gap-3 text-[14px] text-[#1B1F1C] hover:text-[#1F3D2F] transition-colors"
                          >
                            <span
                              className={`w-6 h-6 rounded-full ${a.color} text-white flex items-center justify-center text-xs font-medium`}
                            >
                              {a.name[0]}
                            </span>
                            <span>{a.name}</span>
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              )}
              {following.items.length > 5 && (
                <button
                  type="button"
                  className="mt-4 text-[13px] text-[#1F3D2F] hover:underline"
                >
                  See all {following.items.length}
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
                isOwn ? (
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

              {publishedStories.length > 0 && (
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
              <EmptyState
                title="Nothing saved yet"
                body="Tap the bookmark on any story to keep it here for later."
                ctaLabel="Browse stories"
                ctaTo="/feed"
              />,
            )}

          {activeTab === "about" && (
            <div className="py-7 max-w-prose text-[15px] leading-7 text-[#5C625E]">
              {author.bio?.trim() ? (
                <p>{author.bio}</p>
              ) : isOwn ? (
                <EmptyState
                  title="No bio yet"
                  body="Write a few lines about yourself during onboarding or add one from edit profile."
                  ctaLabel="Add a bio"
                  ctaTo="/profile/edit"
                />
              ) : (
                <p className="text-[#8A8F8B]">No bio yet.</p>
              )}
              <p className="mt-5 text-[13px] text-[#8A8F8B]">
                Member since {author.joined}
              </p>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
};

export const ProfilePage = () => {
  const { handle } = useParams<{ handle?: string }>();
  return <ProfileView key={handle ?? "me"} />;
};

export default ProfilePage;