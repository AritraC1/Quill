import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  MoreHorizontal,
  Share2,
  Copy,
  Flag,
  CheckCircle2,
  Loader2,
  Trash2,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { StoryCard } from "../components/ui/StoryCard";
import { useStoredSet } from "../hooks/useStoredSet";
import {
  ALL_STORIES,
  AUTHORS,
  CURRENT_USER_HANDLE,
  DEFAULT_SAVED,
  FOLLOWING_HANDLES,
  INITIAL_DRAFTS,
  type Draft,
} from "../data/mockProfiles";

type Tab = "stories" | "drafts" | "saved" | "about";

const OWN_TABS: { id: Tab; label: string }[] = [
  { id: "stories", label: "Stories" },
  { id: "drafts", label: "Drafts" },
  { id: "saved", label: "Saved" },
  { id: "about", label: "About" },
];
const VISITOR_TABS = OWN_TABS.filter((t) => t.id === "stories" || t.id === "about");

const timeAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
};

/* ---------- small pieces ---------- */

const EmptyState = ({
  title,
  body,
  ctaLabel,
  ctaTo,
}: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaTo?: string;
}) => (
  <div className="py-16 text-center">
    <p className="font-editorial text-[20px] text-[#1B1F1C]">{title}</p>
    <p className="mt-2 text-[14px] text-[#5C625E] max-w-sm mx-auto">{body}</p>
    {ctaLabel && ctaTo && (
      <Link
        to={ctaTo}
        className="mt-5 inline-flex items-center rounded-full bg-[#1F3D2F] px-4 h-9 text-[13px] font-medium text-white hover:bg-[#2A5240] transition-colors"
      >
        {ctaLabel}
      </Link>
    )}
  </div>
);

const DraftRow = ({
  draft,
  confirming,
  onAskDelete,
  onCancel,
  onDelete,
}: {
  draft: Draft;
  confirming: boolean;
  onAskDelete: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) => (
  <article className="py-6 border-b border-[#E6E2D8]">
    <Link to={`/write/${draft.id}`} className="block group">
      <h2 className="font-editorial text-[21px] leading-snug text-[#1B1F1C] group-hover:underline underline-offset-4 decoration-1">
        {draft.title || "Untitled draft"}
      </h2>
      <p className="mt-1.5 text-[15px] text-[#5C625E] line-clamp-2">{draft.excerpt}</p>
    </Link>
    <div className="mt-4 flex items-center gap-3 text-[13px] text-[#8A8F8B]">
      <span className="rounded-full bg-[#F0EDE4] px-2.5 py-0.5 text-[#5C625E]">Draft</span>
      <span>Edited {timeAgo(draft.updatedAt)}</span>
      <span>{draft.words} words</span>
      <div className="ml-auto flex items-center gap-3">
        {confirming ? (
          <>
            <span className="text-[#5C625E]">Delete this draft?</span>
            <button type="button" onClick={onDelete} className="font-medium text-[#ba1a1a] hover:underline">
              Delete
            </button>
            <button type="button" onClick={onCancel} className="hover:text-[#1B1F1C]">
              Cancel
            </button>
          </>
        ) : (
          <>
            <Link to={`/write/${draft.id}`} className="text-[#1F3D2F] hover:underline">
              Continue writing
            </Link>
            <button
              type="button"
              onClick={onAskDelete}
              aria-label="Delete draft"
              className="p-1.5 rounded-md hover:bg-[#F0EDE4] hover:text-[#ba1a1a] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  </article>
);

const ProfileMenu = ({
  isOwn,
  name,
  onToast,
}: {
  isOwn: boolean;
  name: string;
  onToast: (m: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      onToast("Profile link copied");
    } catch {
      onToast("Couldn’t copy the link");
    }
    setOpen(false);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} on Quill`, url: window.location.href });
      } catch {
        /* user dismissed the share sheet */
      }
      setOpen(false);
    } else {
      void copy();
    }
  };

  const item =
    "w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-[#5C625E] hover:bg-[#F0EDE4] hover:text-[#1B1F1C] transition-colors";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E6E2D8] bg-white text-[#5C625E] hover:border-[#8A8F8B] hover:text-[#1B1F1C] transition-colors"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-48 rounded-xl border border-[#E6E2D8] bg-white py-2 shadow-lg z-30 animate-fade-in">
          <button type="button" role="menuitem" onClick={copy} className={item}>
            <Copy className="w-4 h-4 text-[#8A8F8B]" />
            <span>Copy link</span>
          </button>
          <button type="button" role="menuitem" onClick={share} className={item}>
            <Share2 className="w-4 h-4 text-[#8A8F8B]" />
            <span>Share profile</span>
          </button>
          {!isOwn && (
            <>
              <div className="my-1 border-t border-[#E6E2D8]" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onToast("Thanks, we’ll review this account");
                  setOpen(false);
                }}
                className={`${item} text-[#8A8F8B] hover:text-[#ba1a1a]`}
              >
                <Flag className="w-4 h-4" />
                <span>Report account</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/* ---------- page ---------- */

const ProfileView = () => {
  const { handle } = useParams<{ handle?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Own vs visitor comes from the URL, not a toggle.
  const profileHandle = handle ?? CURRENT_USER_HANDLE;
  const isOwn = profileHandle === CURRENT_USER_HANDLE;
  const author = AUTHORS[profileHandle];

  const bookmarks = useStoredSet("quill_bookmarks", DEFAULT_SAVED);
  const following = useStoredSet("quill_following", []);

  const [drafts, setDrafts] = useState<Draft[]>(INITIAL_DRAFTS);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Tab lives in the URL (?tab=saved) so links like "Saved" in the nav can deep-link.
  const tabs = isOwn ? OWN_TABS : VISITOR_TABS;
  const requested = searchParams.get("tab");
  const activeTab: Tab = tabs.find((t) => t.id === requested)?.id ?? "stories";
  const setTab = (t: Tab) => setSearchParams(t === "stories" ? {} : { tab: t }, { replace: true });

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

  const withSaved = (list: typeof ALL_STORIES) =>
    list.map((s) => ({ ...s, isBookmarked: bookmarks.has(s.id) }));

  const publishedStories = withSaved(ALL_STORIES.filter((s) => s.author.handle === `@${profileHandle}`));
  const savedStories = withSaved(ALL_STORIES.filter((s) => bookmarks.has(s.id)));

  const isFollowing = following.has(profileHandle);
  const followerCount = author.followers + (isFollowing ? 1 : 0);

  const handleBookmark = (storyId: string, next: boolean) => {
    bookmarks.set(storyId, next);
    showToast(next ? "Saved to reading list" : "Removed from saved");
  };

  const handleFollow = () => {
    following.set(profileHandle, !isFollowing);
    showToast(isFollowing ? `Unfollowed ${author.name}` : `Following ${author.name}`);
  };

  const handleDeleteDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setConfirmId(null);
    showToast("Draft deleted");
  };

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => setIsLoadingMore(false), 800); // TODO: wire to pagination
  };

  const renderStories = (list: typeof publishedStories, empty: React.ReactNode) =>
    list.length === 0 ? (
      empty
    ) : (
      <div className="flex flex-col">
        {list.map((story) => (
          <StoryCard key={story.id} story={story} onBookmarkToggle={handleBookmark} />
        ))}
      </div>
    );

  return (
    <AppShell>
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#1F3D2F] px-4 py-2.5 text-[13px] font-medium text-white shadow-xl animate-fade-in"
        >
          {toast}
        </div>
      )}

      <main className="mx-auto max-w-270 px-4 sm:px-6 py-6 md:py-8 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 lg:gap-16">
        {/* Sidebar: first on mobile (order-1), right column on desktop */}
        <aside className="order-1 md:order-2 md:col-span-4 md:sticky md:top-24 md:self-start md:pl-4">
          <div className="flex items-center gap-4 md:block">
            <div className="relative shrink-0 w-16 h-16 md:w-24 md:h-24 md:mb-5">
              <div className={`w-full h-full rounded-full ${author.color} text-white font-editorial text-2xl md:text-4xl flex items-center justify-center select-none`}>
                {author.name[0]}
              </div>
              <span className="absolute bottom-0 right-0 md:bottom-1 md:right-1 flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-[#4E9F76] text-white ring-2 ring-[#F6F3EC]">
                <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-editorial text-[24px] md:font-sans md:text-[17px] md:font-semibold text-[#1B1F1C] truncate">
                {author.name}
              </h2>
              <p className="text-[13px] text-[#8A8F8B] mt-0.5">
                {followerCount.toLocaleString()} Followers
              </p>
            </div>

            <div className="md:hidden">
              <ProfileMenu isOwn={isOwn} name={author.name} onToast={showToast} />
            </div>
          </div>

          <p className="mt-4 md:mt-3.5 text-[14px] leading-5.5 text-[#5C625E]">{author.bio}</p>

          {isOwn ? (
            <Link to="/onboarding" className="mt-4 inline-block text-[14px] text-[#1F3D2F] hover:underline">
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
            <h3 className="text-[13px] font-medium text-[#8A8F8B] mb-3">Topics</h3>
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
              <h3 className="text-[13px] font-medium text-[#8A8F8B] mb-3.5">Following</h3>
              <ul className="space-y-3">
                {FOLLOWING_HANDLES.map((h) => {
                  const a = AUTHORS[h];
                  return (
                    <li key={h}>
                      <Link
                        to={`/u/${h}`}
                        className="flex items-center gap-3 text-[14px] text-[#1B1F1C] hover:text-[#1F3D2F] transition-colors"
                      >
                        <span className={`w-6 h-6 rounded-full ${a.color} text-white flex items-center justify-center text-xs font-medium`}>
                          {a.name[0]}
                        </span>
                        <span>{a.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="mt-4 text-[13px] text-[#1F3D2F] hover:underline">
                See all {author.following}
              </button>
            </div>
          )}
        </aside>

        {/* Main column */}
        <div className="order-2 md:order-1 md:col-span-8 flex flex-col min-w-0">
          <div className="hidden md:flex items-center justify-between pb-6">
            <h1 className="font-editorial text-[42px] font-normal text-[#1B1F1C] tracking-tight">
              {author.name}
            </h1>
            <ProfileMenu isOwn={isOwn} name={author.name} onToast={showToast} />
          </div>

          <div role="tablist" className="flex items-center gap-7 border-b border-[#E6E2D8] mb-2 overflow-x-auto">
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
                  <EmptyState title="No stories yet" body={`${author.name} hasn’t published anything yet.`} />
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
              <div className="flex items-center justify-between py-4 text-[13px] text-[#8A8F8B]">
                <span>Only you can see your drafts.</span>
                <Link to="/write" className="text-[#1F3D2F] hover:underline">
                  New draft
                </Link>
              </div>
              {drafts.length === 0 ? (
                <EmptyState
                  title="No drafts"
                  body="Anything you start writing is saved here until you publish it."
                  ctaLabel="Start writing"
                  ctaTo="/write"
                />
              ) : (
                drafts.map((d) => (
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

          {activeTab === "saved" && isOwn &&
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
              <p>{author.bio}</p>
              <p className="mt-5 text-[13px] text-[#8A8F8B]">Member since {author.joined}</p>
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