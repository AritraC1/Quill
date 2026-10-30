import { useCallback, useEffect, useState } from "react";
import type { NotificationDTO } from "@quill/shared";
import {
  clearNotificationsApi,
  listNotificationsApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  unreadCountApi,
} from "../api/notification.api";
import { PAGE_SIZE } from "../components/NotificationBell";

/**
 * State + polling for the bell in the navbar.
 *
 * The unread badge is polled every 30s (simple first version — live updates
 * via SSE/WebSockets can replace this later). The dropdown list is loaded
 * when the panel opens and "Load more" pages through older notifications.
 */
export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Badge refresh — a failure keeps the last known count (transient network
  // hiccups should not flash the bell). Written with .then() so setState
  // happens in a callback, not synchronously in the caller.
  const refreshUnread = useCallback(() => {
    unreadCountApi()
      .then(({ count }) => setUnreadCount(count))
      .catch(() => {
        // ignore — the next poll will retry
      });
  }, []);

  // Poll the unread badge
  useEffect(() => {
    refreshUnread();
    const timer = setInterval(refreshUnread, 30_000);
    return () => clearInterval(timer);
  }, [refreshUnread]);

  // Load / reload the list (only called from event handlers)
  const fetchPage = useCallback(async (nextPage: number) => {
    setLoading(true);
    try {
      const result = await listNotificationsApi(nextPage, PAGE_SIZE);
      setNotifications((prev) =>
        nextPage === 1 ? result.items : [...prev, ...result.items],
      );
      setTotal(result.total);
      setPage(nextPage);
    } catch {
      // ignore — keep whatever is already shown
    } finally {
      setLoading(false);
    }
  }, []);

  // Open the dropdown and fetch fresh data — no effect needed
  const openPanel = useCallback(() => {
    setOpen(true);
    void fetchPage(1);
  }, [fetchPage]);
  const closePanel = useCallback(() => setOpen(false), []);

  // "Mark as read" on one item, then reflect it locally without a refetch
  const markRead = useCallback(
    (id: string) => {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id && !n.readAt
            ? { ...n, readAt: new Date().toISOString() }
            : n,
        ),
      );
      setUnreadCount((c) => Math.max(c - 1, 0));
      void markNotificationReadApi(id).catch(refreshUnread);
    },
    [refreshUnread],
  );

  // Mark everything read
  const markAllRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.readAt ? n : { ...n, readAt: new Date().toISOString() },
      ),
    );
    setUnreadCount(0);
    void markAllNotificationsReadApi().catch(refreshUnread);
  }, [refreshUnread]);

  // "Clear" — wipe the list locally, then confirm on the server
  const clearAll = useCallback(() => {
    setNotifications([]);
    setTotal(0);
    setUnreadCount(0);
    void clearNotificationsApi().catch(refreshUnread);
  }, [refreshUnread]);

  // Older pages ("Load more")
  const loadMore = useCallback(() => {
    if (notifications.length < total) void fetchPage(page + 1);
  }, [fetchPage, page, notifications.length, total]);

  return {
    unreadCount,
    notifications,
    hasMore: notifications.length < total,
    loading,
    open,
    openPanel,
    closePanel,
    markRead,
    markAllRead,
    clearAll,
    loadMore,
  } as const;
}
