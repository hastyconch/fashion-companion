/** Today's calendar date (YYYY-MM-DD) in an IANA time zone, or null if the zone is invalid. */
export function localDateIn(timeZone: string | null | undefined, now = new Date()): string | null {
  if (!timeZone || timeZone.length > 64) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return null; // RangeError: unknown time zone
  }
}
