import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { FollowerDTO } from "@quill/shared";
import { assetUrl } from "../../auth/api/auth.api";
import { listFollowersApi, setFollowApi } from "../api/profile.api";
import { useStoredSet } from "../../../hooks/useStoredSet";
import { DEFAULT_FOLLOWING } from "../../../data/mockProfiles";

const PAGE_LIMIT = 10; // 10 followers per page — scroll to the bottom for the next 10

interface FollowersModalProps {
  open: boolean;
  onClose: () => void;
  /** The profile whose followers are being shown */
  name: string;
  handle: string;
  /** Own profile: the button becomes a "Follow back" action */
  isOwn: boolean;
}

/**
 * Wrapper: the content only mounts while the modal is open, so every open
 * starts from the initial state (no manual reset inside an effect needed).
 * `key={handle}` remounts the content if the profile changes while open.
 */
const FollowersModal = ({
  open,
  onClose,
  name,
  handle,
  isOwn,
}: FollowersModalProps) => {
  if (!open) return null;

  return (
    <FollowersModalContent
      key={handle}
      onClose={onClose}
      name={name}
      handle={handle}
      isOwn={isOwn}
    />
  );
};

const FollowersModalContent = ({
  onClose,
  name,
  handle,
  isOwn,
}: Omit<FollowersModalProps, "open">) => {
  const [users, setUsers] = useState<FollowerDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true); // first page loads from mount
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(true); // guards the IntersectionObserver against double fetches (first page is in flight from mount)
  const [pendingFollowId, setPendingFollowId] = useState<string | null>(null);
  const pendingFollowRef = useRef<string | null>(null); // synchronous double-tap guard

  // Keep the shared follow state in sync (the feed's Following tab reads it)
  const following = useStoredSet("quill_following", DEFAULT_FOLLOWING);

  const hasMore = users.length < total;

  // First page — runs once on mount (the component is remounted on every open).
  // setState only happens inside async callbacks.
  useEffect(() => {
    let cancelled = false;

    listFollowersApi(handle, 1, PAGE_LIMIT)
      .then((res) => {
        if (!cancelled) {
          setUsers(res.items);
          setTotal(res.total);
          setPage(1);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load followers");
      })
      .finally(() => {
        loadingRef.current = false;
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [handle]);

  // Infinite scroll — the next page loads when the sentinel becomes visible
  useEffect(() => {
    if (isLoading || !hasMore || isLoadingMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingRef.current) return;
        loadingRef.current = true;
        const next = page + 1;
        setIsLoadingMore(true);
        listFollowersApi(handle, next, PAGE_LIMIT)
          .then((res) => {
            setUsers((prev) => [
              ...prev,
              ...res.items.filter((u) => !prev.some((p) => p.id === u.id)),
            ]);
            setTotal(res.total);
            setPage(next);
          })
          .catch(() => toast.error("Could not load more followers"))
          .finally(() => {
            loadingRef.current = false;
            setIsLoadingMore(false);
          });
      },
      { root: scrollRef.current, rootMargin: "0px 0px 160px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handle, isLoading, hasMore, isLoadingMore, page]);

  // Close on Escape and lock the page behind the modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Follow back — optimistic row update, reverted on failure
  const toggleFollow = (user: FollowerDTO) => {
    if (!user.handle) return;
    // One request per row at a time: overlapping follow/unfollow taps can
    // settle out of order and leave the button out of sync with the server
    if (pendingFollowRef.current === user.id) return;
    const next = !user.isFollowing;
    pendingFollowRef.current = user.id;
    setPendingFollowId(user.id);
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, isFollowing: next } : u)),
    );
    if (user.handle) following.set(user.handle, next);
    setFollowApi(user.handle, next)
      .then(() =>
        toast(next ? `Following ${user.name}` : `Unfollowed ${user.name}`, {
          id: `follow-${user.id}`, // a rapid second tap replaces the toast
        }),
      )
      .catch(() => {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id ? { ...u, isFollowing: !next } : u,
          ),
        );
        if (user.handle) following.set(user.handle, !next);
        toast.error("Could not update follow");
      })
      .finally(() => {
        pendingFollowRef.current = null;
        setPendingFollowId(null);
      });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${name}'s followers`}
        className="flex max-h-[80vh] w-full max-w-100 flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6E2D8] px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-[#1B1F1C]">
              Followers
            </h3>
            <p className="truncate text-[12px] text-[#8A8F8B]">
              {name} · {isLoading ? "…" : total.toLocaleString()} followers
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8A8F8B] hover:bg-[#F0EDE4] hover:text-[#1B1F1C] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* List — paginated, one page of 10 at a time while scrolling */}
        <div ref={scrollRef} className="min-h-40 flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="py-12 text-center text-[13px] text-[#8A8F8B]">
              Loading followers…
            </p>
          ) : users.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-[#8A8F8B]">
              No followers yet.
            </p>
          ) : (
            <ul className="divide-y divide-[#F0EDE4]">
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                  {u.handle ? (
                    <Link
                      to={`/${u.handle}`}
                      onClick={onClose}
                      className="group flex min-w-0 flex-1 items-center gap-3"
                    >
                      {u.avatar ? (
                        <img
                          src={assetUrl(u.avatar)}
                          alt={`${u.name}'s photo`}
                          className="h-10 w-10 shrink-0 rounded-full object-cover group-hover:opacity-90 transition-opacity"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full bg-[#B27D56] font-editorial text-lg text-white group-hover:opacity-90 transition-opacity">
                          {u.name[0]}
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-[#1B1F1C] group-hover:text-[#1F3D2F] group-hover:underline transition-colors">
                          {u.name}
                        </p>
                        <p className="truncate text-[12px] text-[#8A8F8B]">
                          @{u.handle}
                        </p>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {u.avatar ? (
                        <img
                          src={assetUrl(u.avatar)}
                          alt={`${u.name}'s photo`}
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full bg-[#B27D56] font-editorial text-lg text-white">
                          {u.name[0]}
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] text-[#1B1F1C]">
                          {u.name}
                        </p>
                        <p className="truncate text-[12px] text-[#8A8F8B]">
                          No handle yet
                        </p>
                      </div>
                    </div>
                  )}

                  {u.handle ? (
                    <button
                      type="button"
                      onClick={() => toggleFollow(u)}
                      disabled={pendingFollowId === u.id}
                      aria-pressed={u.isFollowing}
                      className={`h-8 shrink-0 rounded-full border px-4 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        u.isFollowing
                          ? "border-[#E6E2D8] text-[#1F3D2F] hover:bg-[#F0EDE4]"
                          : "border-[#1F3D2F] bg-[#1F3D2F] text-white hover:bg-[#2A5240]"
                      }`}
                    >
                      {pendingFollowId === u.id
                        ? "…"
                        : u.isFollowing
                          ? "Following"
                          : isOwn
                            ? "Follow back"
                            : "Follow"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {/* Sentinel for the next page */}
          {hasMore && !isLoading && (
            <div ref={sentinelRef} className="h-px" aria-hidden />
          )}
          {isLoadingMore && (
            <p className="py-4 text-center text-[12px] text-[#8A8F8B]">
              Loading more…
            </p>
          )}
          {!hasMore && !isLoading && users.length > 0 && (
            <p className="py-4 text-center text-[12px] text-[#8A8F8B]">
              You’ve seen all {total.toLocaleString()} followers
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowersModal;
