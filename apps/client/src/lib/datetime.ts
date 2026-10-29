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
