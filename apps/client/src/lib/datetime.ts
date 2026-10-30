/** Shared date helpers */

/**
 * Format a Date as a local "YYYY-MM-DDTHH:mm" string, the shape
 * `<input type="datetime-local">` expects (it must not be UTC-ish ISO).
 */
export function toLocalDateTimeInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

/**
 * Compact "time ago" label for notification rows: "just now", "5m", "2h",
 * "3d", then the date itself ("Jan 7", with the year for older entries).
 */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const sameYear = new Date(then).getFullYear() === new Date().getFullYear();
  return new Date(then).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

