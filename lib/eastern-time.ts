/**
 * Time helpers for TutorMe, which runs on Eastern time (mvp-spec.md:
 * "Default time zone is Eastern").
 *
 * The database stores exact moments (UTC). People think in Eastern dates and
 * clock times. These helpers convert between the two and always pass the
 * time zone explicitly, so results are the same on a laptop in New York and
 * on a server in UTC. Daylight saving is handled by building every time from
 * an Eastern date + clock time, never by adding hours to a moment.
 */
export const EASTERN = "America/New_York";

/** Minutes east of UTC in Eastern time at a moment, e.g. -300 (EST) or -240 (EDT). */
function easternOffsetMinutes(at: Date): number {
  const zoneName =
    new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = zoneName.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * The exact moment of an Eastern date and clock time.
 *   easternMoment("2026-11-20", "15:00") → 2026-11-20T20:00:00Z
 */
export function easternMoment(isoDate: string, clockTime: string): Date {
  const hhmm = clockTime.slice(0, 5);
  const asIfUtc = new Date(`${isoDate}T${hhmm}:00Z`);
  // Guess with the offset at that instant, then correct once in case the
  // guess landed on the other side of a daylight-saving change.
  let moment = new Date(asIfUtc.getTime() - easternOffsetMinutes(asIfUtc) * 60_000);
  const corrected = new Date(asIfUtc.getTime() - easternOffsetMinutes(moment) * 60_000);
  if (corrected.getTime() !== moment.getTime()) moment = corrected;
  return moment;
}

/** The Eastern calendar date of a moment, as "YYYY-MM-DD". */
export function easternDate(at: Date): string {
  // The en-CA format happens to be YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: EASTERN }).format(at);
}

/** The Eastern clock time of a moment, as "HH:MM" (24-hour). */
export function easternClock(at: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: EASTERN, hour: "2-digit", minute: "2-digit" }).format(at);
}

/** Day of the week for an ISO date: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

/** The ISO date `days` days after `isoDate` (calendar days, not 24h blocks). */
export function addDays(isoDate: string, days: number): string {
  const noon = new Date(`${isoDate}T12:00:00Z`);
  noon.setUTCDate(noon.getUTCDate() + days);
  return noon.toISOString().slice(0, 10);
}

/** "Thu, Nov 20 · 3:00 PM" in Eastern time. */
export function formatSessionTime(at: Date): string {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, weekday: "short", month: "short", day: "numeric" }).format(at);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, hour: "numeric", minute: "2-digit" }).format(at);
  return `${day} · ${time}`;
}

/** "3:00 PM" from a clock time like "15:00" or "15:00:00". */
export function formatClock(clockTime: string): string {
  const [hours, minutes] = clockTime.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** A compact range for small spaces: "3–6pm", "11:30am–1pm". */
export function formatClockRange(startTime: string, endTime: string): string {
  const parts = (clockTime: string) => {
    const [hours, minutes] = clockTime.split(":").map(Number);
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return { label: minutes ? `${hour12}:${String(minutes).padStart(2, "0")}` : String(hour12), suffix: hours >= 12 ? "pm" : "am" };
  };
  const start = parts(startTime);
  const end = parts(endTime);
  // Only repeat am/pm on the start when it differs from the end.
  return `${start.label}${start.suffix === end.suffix ? "" : start.suffix}–${end.label}${end.suffix}`;
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
