import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import type { NotificationDTO } from "@quill/shared";
import { useNotifications } from "../hooks/useNotifications";
import { assetUrl } from "../../auth/api/auth.api";
import { getInitials } from "../../../lib/initials";
import { formatRelativeTime } from "../../../lib/datetime";

// Rows per page for the dropdown list
export const PAGE_SIZE = 20;

// "Sam started following you" / "Alex published a new story" / club events
const messageFor = (n: NotificationDTO): string => {
  switch (n.type) {
    case "new_follower":
      return `${n.actor.name} started following you`;
    case "scheduled_post_published":
      return "Your scheduled story is now live";
    case "comment_reply":
      return `${n.actor.name} replied to your comment`;
    case "club_invite":
      return `${n.actor.name} invited you to join ${n.club?.name ?? "a club"}`;
    case "club_application":
      return `${n.actor.name} applied to join ${n.club?.name ?? "your club"}`;
    case "club_review":
      return `${n.actor.name} reviewed your submission in ${n.club?.name ?? "your club"}`;
    default:
      return `${n.actor.name} published a new story`;
  }
};

const targetFor = (n: NotificationDTO): string => {
  if (n.type === "new_follower") return n.actor.handle ? `/${n.actor.handle}` : "/feed";
  // Review feedback lands in the editor, where the reviewer's note is shown
  if (n.type === "club_review") return n.blog ? `/write/${n.blog.id}` : "/my-clubs";
  if (n.type === "club_invite" || n.type === "club_application") return "/my-clubs";
  return n.blog ? `/blog/${n.blog.id}` : "/feed";
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const {
    unreadCount,
    notifications,
    hasMore,
    loading,
    open,
    openPanel,
    closePanel,
    markRead,
    markAllRead,
    clearAll,
    loadMore,
  } = useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        closePanel();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closePanel]);

  const onNotificationClick = (n: NotificationDTO) => {
    if (!n.readAt) markRead(n.id);
    const to = targetFor(n);
    if (to) {
      closePanel();
      navigate(to);
    }
  };

  return (
    <div className="relative hidden sm:block" ref={panelRef}>
      {/* Bell + unread badge */}
      <button
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        className={`flex p-1.5 text-[#5C625E] hover:text-[#1B1F1C] transition-colors ${
          open ? "text-[#1B1F1C]" : ""
        }`}
        title="Notifications"
        aria-label={`Notifications${
          unreadCount > 0 ? ` (${unreadCount} unread)` : ""
        }`}
        aria-expanded={open}
      >
        <Bell className="w-5 h-5 stroke-[1.6]" />
        {unreadCount > 0 && (
          <span className="absolute flex items-center justify-center min-w-4 h-4 -top-0.5 -right-0.5 rounded-full bg-[#C0392B] px-1 text-[9px] font-semibold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] flex flex-col rounded-xl border border-[#E6E2D8] bg-white shadow-xl z-50 animate-fade-in overflow-hidden">
          {/* Header — unread badge, mark all read, clear */}
          <div className="flex items-center justify-between border-b border-[#E6E2D8] px-4 py-2.5">
            <div className="flex items-baseline gap-2">
              <span className="text-[14px] font-semibold text-[#1B1F1C]">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#C0392B]/10 px-2 py-0.5 text-[10px] font-medium text-[#C0392B]">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] font-medium">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[#1F3D2F] hover:underline"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[#C0392B] hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-[#8A8F8B]">
                Loading…
              </p>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Inbox className="w-6 h-6 text-[#C4BFB3]" />
                <p className="text-[13px] font-medium text-[#5C625E]">
                  No notifications yet
                </p>
                <p className="text-[12px] text-[#8A8F8B]">
                  New stories and followers will show up here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#EFECE4]">
                {notifications.map((n) => {
                  const unread = !n.readAt;
                  return (
                    <li
                      key={n.id}
                      className={`group flex gap-3 px-4 py-3 transition-colors ${
                        unread ? "bg-[#F6F3EC]" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onNotificationClick(n)}
                        className="flex min-w-0 flex-1 gap-3 text-left"
                      >
                        {/* Actor avatar (falls back to initials) */}
                        {n.actor.avatar ? (
                          <img
                            src={assetUrl(n.actor.avatar)}
                            alt=""
                            className="w-9 h-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1F3D2F]/10 font-newsreader text-sm text-[#1F3D2F]">
                            {getInitials(n.actor.name) || "?"}
                          </span>
                        )}

                        <span className="min-w-0">
                          <span className="block text-[13px] leading-snug text-[#1B1F1C]">
                            {messageFor(n)}
                          </span>
                          {/* The story behind a "published" notification */}
                          {n.blog?.title && (
                            <span className="mt-0.5 block truncate text-[12px] font-medium text-[#5C625E]">
                              “{n.blog.title}”
                            </span>
                          )}
                          <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[#8A8F8B]">
                            {formatRelativeTime(n.createdAt)}
                            {unread && (
                              <>
                                <span>·</span>
                                <span className="font-medium text-[#C0392B]">
                                  Unread
                                </span>
                              </>
                            )}
                          </span>
                        </span>
                      </button>

                      {/* "Mark as read" — only on unread items */}
                      {unread && (
                        <button
                          type="button"
                          onClick={() => markRead(n.id)}
                          aria-label="Mark as read"
                          title="Mark as read"
                          className="h-7 rounded-full p-1.5 text-[#8A8F8B] hover:bg-[#EAE6DD] hover:text-[#1F3D2F]"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Load more */}
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="border-t border-[#E6E2D8] px-4 py-2 text-center text-[12px] font-medium text-[#1F3D2F] hover:bg-[#F6F3EC] disabled:opacity-60"
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
