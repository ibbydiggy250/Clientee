/**
 * Zoom meetings for booked sessions (mvp-spec.md, "Scheduling and sessions"):
 * every booking gets a meeting on TutorMe's Zoom account, under the tutor's
 * license, and the join link is saved on the session.
 *
 * NOT CONNECTED YET. Until these three settings exist, every function here
 * quietly does nothing and sessions show "Zoom link coming soon":
 *
 *   ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
 *
 * They come from a "Server-to-Server OAuth" app on TutorMe's Zoom account
 * (scopes: meeting:write:admin, meeting:read:admin). Put them in .env.local
 * and new bookings start getting real meetings, no other code changes.
 * Each tutor's Zoom user goes in `tutors.zoom_user_id`; without one, the
 * meeting is created under the account owner ("me").
 *
 * Booking never fails because of Zoom. If a Zoom call fails, the session is
 * still booked, just without a link, and the error is logged.
 */
import { eq } from "drizzle-orm";

import { enrollments, sessions, tutors } from "@/db/schema";
import { orm } from "@/lib/db";

const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";
const ZOOM_API = "https://api.zoom.us/v2";

/** True once all three Zoom settings are present. */
export function isZoomConnected(): boolean {
  return Boolean(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
}

// ---------------------------------------------------------------------------
// What the rest of the app calls
// ---------------------------------------------------------------------------

/** After booking: create a meeting for each new session and save its link. */
export async function addMeetingsToSessions(sessionIds: string[]): Promise<void> {
  if (!isZoomConnected()) return;
  for (const sessionId of sessionIds) {
    await safely(`create a meeting for session ${sessionId}`, () => createMeetingFor(sessionId));
  }
}

/**
 * After a session moves: change the meeting's time. A session booked before
 * Zoom was connected has no meeting yet, so it gets one now.
 */
export async function moveMeeting(sessionId: string): Promise<void> {
  if (!isZoomConnected()) return;
  await safely(`move the meeting for session ${sessionId}`, async () => {
    const session = await loadSession(sessionId);
    if (!session.zoomMeetingId) return createMeetingFor(sessionId);
    await zoomRequest("PATCH", `/meetings/${session.zoomMeetingId}`, {
      start_time: session.startsAt.toISOString(),
      duration: minutesBetween(session.startsAt, session.endsAt),
    });
  });
}

/** After a session is cancelled: delete its meeting, if it has one. */
export async function cancelMeeting(sessionId: string): Promise<void> {
  if (!isZoomConnected()) return;
  await safely(`delete the meeting for session ${sessionId}`, async () => {
    const session = await loadSession(sessionId);
    if (!session.zoomMeetingId) return;
    await zoomRequest("DELETE", `/meetings/${session.zoomMeetingId}`);
  });
}

// ---------------------------------------------------------------------------
// Talking to Zoom
// ---------------------------------------------------------------------------

async function loadSession(sessionId: string) {
  const [row] = await orm
    .select({
      zoomMeetingId: sessions.zoomMeetingId,
      startsAt: sessions.startsAt,
      endsAt: sessions.endsAt,
      subject: enrollments.subject,
      zoomUserId: tutors.zoomUserId,
    })
    .from(sessions)
    .innerJoin(enrollments, eq(enrollments.id, sessions.enrollmentId))
    .innerJoin(tutors, eq(tutors.id, sessions.taughtBy))
    .where(eq(sessions.id, sessionId));
  if (!row) throw new Error("session not found");
  return row;
}

async function createMeetingFor(sessionId: string): Promise<void> {
  const session = await loadSession(sessionId);
  const host = session.zoomUserId ?? "me";

  // The topic names the subject only, never the learner (many are minors).
  const meeting = (await zoomRequest("POST", `/users/${encodeURIComponent(host)}/meetings`, {
    topic: `TutorMe · ${session.subject}`,
    type: 2, // a scheduled meeting
    start_time: session.startsAt.toISOString(),
    duration: minutesBetween(session.startsAt, session.endsAt),
    timezone: "America/New_York",
    settings: { join_before_host: false, waiting_room: true },
  })) as { id: number; join_url: string };

  await orm
    .update(sessions)
    .set({ zoomMeetingId: String(meeting.id), zoomJoinUrl: meeting.join_url })
    .where(eq(sessions.id, sessionId));
}

/** A cached access token, refreshed a minute before Zoom says it expires. */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const credentials = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64");
  const url = `${ZOOM_TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(process.env.ZOOM_ACCOUNT_ID ?? "")}`;
  const response = await fetch(url, { method: "POST", headers: { Authorization: `Basic ${credentials}` } });
  if (!response.ok) throw new Error(`Zoom sign-in failed (${response.status})`);

  const body = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return body.access_token;
}

async function zoomRequest(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(ZOOM_API + path, {
    method,
    headers: { Authorization: `Bearer ${await getAccessToken()}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // Deleting a meeting that's already gone is fine.
  if (method === "DELETE" && response.status === 404) return null;
  if (!response.ok) throw new Error(`Zoom ${method} ${path} failed (${response.status})`);
  return response.status === 204 ? null : response.json();
}

function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

/** Runs a Zoom step; a failure is logged, never passed on to the family. */
async function safely(what: string, step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch (problem) {
    console.error(`Zoom: couldn't ${what}:`, problem);
  }
}
