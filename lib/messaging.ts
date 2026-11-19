/**
 * Messaging (mvp-spec.md, "Messaging and anti-bypass"), with the choices made
 * on Nov 19, 2026:
 *
 *   - Threads: learner ↔ tutor, account holder ↔ TutorMe, tutor ↔ TutorMe.
 *     A learner without a login is represented by their account holder.
 *     A minor's account holder can read (not post in) their thread with the tutor.
 *     "TutorMe" is any admin; admins read every thread and reply in TutorMe threads.
 *   - The contact filter HOLDS matching messages until admin delivers or rejects them.
 *   - Live updates poll for now. The message query below is written so it can
 *     later be sealed for Neon Realtime unchanged (see threadMessagesQuery).
 *
 * Threads are created lazily: whenever someone opens Messages, the threads
 * they should have are made (or their participants updated), so a match
 * approved a minute ago already has its conversation.
 *
 * Writes run as the database owner, so every function checks permissions.
 */
import { and, desc, eq, gt, inArray, ne, or, sql } from "drizzle-orm";

import { accounts, enrollments, learners, messages, profiles, threadReads, threads, tutors } from "@/db/schema";
import type { SignedInUser } from "@/lib/auth/current-user";
import { checkForContactInfo } from "@/lib/contact-filter";
import { orm, withUser } from "@/lib/db";
import { hasPostgresCode } from "@/lib/db-errors";
import { publicTutorName } from "@/lib/public-name";
import { roleOf, type Role } from "@/lib/roles";

export const MAX_MESSAGE_LENGTH = 4000;

/** A problem the person can fix; its message is safe to show. */
export class MessagingError extends Error {}

type Thread = typeof threads.$inferSelect;
type Viewer = SignedInUser & { role: Role };

async function asViewer(user: SignedInUser): Promise<Viewer> {
  const role = await roleOf(user.id);
  if (!role) throw new MessagingError("Finish signing up before using messages.");
  return { ...user, role };
}

// ---------------------------------------------------------------------------
// Making sure the right threads exist
// ---------------------------------------------------------------------------

/** Inserts a thread, or returns the existing one if the unique rule says it's already there. */
async function insertThreadOnce(values: typeof threads.$inferInsert, findExisting: () => Promise<Thread | undefined>) {
  const existing = await findExisting();
  if (existing) return existing;
  try {
    const [created] = await orm.insert(threads).values(values).returning();
    return created;
  } catch (problem) {
    // Someone opened Messages at the same moment and made it first.
    if (hasPostgresCode(problem, "23505")) return findExisting();
    throw problem;
  }
}

/**
 * The learner ↔ tutor thread for one match. Participants: the tutor, and the
 * learner — or their account holder when the learner has no login.
 */
export async function syncLearnerTutorThread(learnerId: string, tutorId: string): Promise<void> {
  const [row] = await orm
    .select({ learner: learners, ownerId: accounts.ownerId })
    .from(learners)
    .innerJoin(accounts, eq(accounts.id, learners.accountId))
    .where(eq(learners.id, learnerId));
  const [tutor] = await orm.select({ profileId: tutors.profileId }).from(tutors).where(eq(tutors.id, tutorId));
  if (!row || !tutor?.profileId) return;

  const seat = row.learner.profileId ?? row.ownerId;
  const participantIds = [tutor.profileId, seat];

  const thread = await insertThreadOnce({ kind: "learner_tutor", learnerId, tutorId, participantIds }, async () => {
    const [found] = await orm
      .select()
      .from(threads)
      .where(and(eq(threads.kind, "learner_tutor"), eq(threads.learnerId, learnerId), eq(threads.tutorId, tutorId)));
    return found;
  });

  // The learner got their own login since: they take the seat.
  if (thread && thread.participantIds.join() !== participantIds.join()) {
    await orm.update(threads).set({ participantIds }).where(eq(threads.id, thread.id));
  }
}

async function syncFamilyThread(accountId: string, ownerId: string) {
  await insertThreadOnce({ kind: "family_tutorme", accountId, participantIds: [ownerId] }, async () => {
    const [found] = await orm.select().from(threads).where(and(eq(threads.kind, "family_tutorme"), eq(threads.accountId, accountId)));
    return found;
  });
}

async function syncTutorThread(tutorId: string, profileId: string) {
  await insertThreadOnce({ kind: "tutor_tutorme", tutorId, participantIds: [profileId] }, async () => {
    const [found] = await orm.select().from(threads).where(and(eq(threads.kind, "tutor_tutorme"), eq(threads.tutorId, tutorId)));
    return found;
  });
}

/** Creates (or updates) every thread this person should have. */
async function syncThreadsFor(viewer: Viewer): Promise<void> {
  if (viewer.role === "tutor") {
    const [tutor] = await orm.select().from(tutors).where(eq(tutors.profileId, viewer.id));
    if (!tutor) return;
    await syncTutorThread(tutor.id, viewer.id);
    if (tutor.status === "active" || tutor.status === "offboarding") {
      const matches = await orm
        .select({ learnerId: enrollments.learnerId })
        .from(enrollments)
        .where(and(eq(enrollments.tutorId, tutor.id), eq(enrollments.status, "active")));
      for (const match of matches) await syncLearnerTutorThread(match.learnerId, tutor.id);
    }
    return;
  }

  if (viewer.role === "client") {
    const [account] = await orm.select().from(accounts).where(eq(accounts.ownerId, viewer.id));
    if (account) await syncFamilyThread(account.id, viewer.id);

    // The learners this person speaks for: their account's learners, or themselves.
    const myLearners = await orm
      .select({ id: learners.id })
      .from(learners)
      .where(account ? or(eq(learners.accountId, account.id), eq(learners.profileId, viewer.id)) : eq(learners.profileId, viewer.id));
    if (myLearners.length === 0) return;

    const matches = await orm
      .select({ learnerId: enrollments.learnerId, tutorId: enrollments.tutorId })
      .from(enrollments)
      .where(and(inArray(enrollments.learnerId, myLearners.map((learner) => learner.id)), eq(enrollments.status, "active")));
    for (const match of matches) await syncLearnerTutorThread(match.learnerId, match.tutorId);
  }
  // Admins don't need threads made for them: they see everyone's.
}

// ---------------------------------------------------------------------------
// Who may do what in a thread
// ---------------------------------------------------------------------------

/** The thread, if row-level security lets this person see it. */
async function visibleThread(viewer: Viewer, threadId: string): Promise<Thread | null> {
  const [thread] = await withUser(viewer.id, (tx) =>
    tx
      .select({
        id: threads.id,
        learnerId: threads.learnerId,
        participantIds: threads.participantIds,
        kind: threads.kind,
        tutorId: threads.tutorId,
        accountId: threads.accountId,
        createdAt: threads.createdAt,
      })
      .from(threads)
      .where(eq(threads.id, threadId)),
  );
  return thread ?? null;
}

/**
 * Participants can post. Admins post as "TutorMe" in TutorMe threads and only
 * read learner ↔ tutor threads. A minor's parent reading along can't post.
 */
function canPost(viewer: Viewer, thread: Thread): boolean {
  if (viewer.role === "admin") return thread.kind !== "learner_tutor";
  return thread.participantIds.includes(viewer.id);
}

// ---------------------------------------------------------------------------
// The message query (the live-update seam)
// ---------------------------------------------------------------------------

/**
 * The messages one person may see in one thread, oldest first.
 *
 * This query authorizes in its own SQL (delivered messages, plus the viewer's
 * own held/rejected ones, or everything for admin) rather than relying on
 * row-level security. That is on purpose: today it's run by the polling route,
 * and when we switch to Neon Realtime the very same query can be sealed with
 * `realtime.seal({ query: threadMessagesQuery(...) })`, which requires that
 * no RLS is involved. Thread access is checked separately before it runs.
 */
export function threadMessagesQuery(viewer: { id: string; isAdmin: boolean }, threadId: string) {
  return orm
    .select({
      id: messages.id,
      body: messages.body,
      status: messages.status,
      flagReason: messages.flagReason,
      senderId: messages.senderId,
      senderName: profiles.name,
      senderRole: profiles.role,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(profiles, eq(profiles.id, messages.senderId))
    .where(
      and(
        eq(messages.threadId, threadId),
        viewer.isAdmin ? undefined : or(eq(messages.status, "delivered"), eq(messages.senderId, viewer.id)),
      ),
    )
    .orderBy(messages.createdAt)
    .limit(500);
}

export type MessageView = {
  id: string;
  body: string;
  status: "delivered" | "held" | "rejected";
  isMine: boolean;
  senderLabel: string;
  /** Shown only to the sender and admin, for held messages. */
  flagReason: string | null;
  createdAt: string; // ISO, so it travels to the browser unchanged
};

/** How a sender's name is shown to this viewer. */
function senderLabel(viewer: Viewer, sender: { id: string; name: string; role: Role }): string {
  if (sender.id === viewer.id) return "You";
  if (sender.role === "admin") return "TutorMe";
  if (viewer.role === "admin") return sender.name;
  if (sender.role === "tutor") return publicTutorName(sender.name);
  return sender.name.split(" ")[0];
}

async function loadMessages(viewer: Viewer, threadId: string): Promise<MessageView[]> {
  const rows = await threadMessagesQuery({ id: viewer.id, isAdmin: viewer.role === "admin" }, threadId);
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    status: row.status,
    isMine: row.senderId === viewer.id,
    senderLabel: senderLabel(viewer, { id: row.senderId, name: row.senderName, role: row.senderRole }),
    flagReason: row.senderId === viewer.id || viewer.role === "admin" ? row.flagReason : null,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function markRead(viewerId: string, threadId: string, at: Date): Promise<void> {
  await orm
    .insert(threadReads)
    .values({ threadId, profileId: viewerId, lastReadAt: at })
    .onConflictDoUpdate({ target: [threadReads.threadId, threadReads.profileId], set: { lastReadAt: at } });
}

// ---------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------

/** What a thread is called, from this viewer's point of view. */
async function describeThread(viewer: Viewer, thread: Thread): Promise<{ title: string; subtitle: string }> {
  const [tutorRow] = thread.tutorId
    ? await orm
        .select({ name: profiles.name })
        .from(tutors)
        .innerJoin(profiles, eq(profiles.id, tutors.profileId))
        .where(eq(tutors.id, thread.tutorId))
    : [];
  const [learnerRow] = thread.learnerId
    ? await orm.select({ name: learners.name }).from(learners).where(eq(learners.id, thread.learnerId))
    : [];
  const [ownerRow] = thread.accountId
    ? await orm
        .select({ name: profiles.name })
        .from(accounts)
        .innerJoin(profiles, eq(profiles.id, accounts.ownerId))
        .where(eq(accounts.id, thread.accountId))
    : [];

  const tutorName = tutorRow?.name ?? "Tutor";
  const learnerName = learnerRow?.name ?? "Learner";

  if (thread.kind === "learner_tutor") {
    if (viewer.role === "admin") return { title: `${learnerName} ↔ ${tutorName}`, subtitle: "Learner and tutor" };
    if (viewer.role === "tutor") return { title: learnerName, subtitle: "Your learner" };
    return { title: publicTutorName(tutorName), subtitle: `${learnerName.split(" ")[0]}'s tutor` };
  }
  if (thread.kind === "family_tutorme") {
    return viewer.role === "admin"
      ? { title: ownerRow?.name ?? "Family", subtitle: "Family ↔ TutorMe" }
      : { title: "TutorMe", subtitle: "Questions about matching, booking or billing" };
  }
  return viewer.role === "admin"
    ? { title: tutorName, subtitle: "Tutor ↔ TutorMe" }
    : { title: "TutorMe", subtitle: "Questions about your contract, schedule or pay" };
}

// ---------------------------------------------------------------------------
// Reads for the screens
// ---------------------------------------------------------------------------

export type ThreadSummary = {
  id: string;
  kind: Thread["kind"];
  title: string;
  subtitle: string;
  lastMessage: string | null;
  lastActivityAt: string | null;
  unread: number;
  canPost: boolean;
};

/** Every conversation this person can see, most recent first. */
export async function listThreads(user: SignedInUser): Promise<ThreadSummary[]> {
  const viewer = await asViewer(user);
  await syncThreadsFor(viewer);

  // Row-level security decides which threads are visible.
  const visible = await withUser(viewer.id, (tx) =>
    tx
      .select({
        id: threads.id,
        learnerId: threads.learnerId,
        participantIds: threads.participantIds,
        kind: threads.kind,
        tutorId: threads.tutorId,
        accountId: threads.accountId,
        createdAt: threads.createdAt,
      })
      .from(threads),
  );
  if (visible.length === 0) return [];
  const ids = visible.map((thread) => thread.id);
  const isAdmin = viewer.role === "admin";
  const canSee = isAdmin ? undefined : or(eq(messages.status, "delivered"), eq(messages.senderId, viewer.id));

  // The latest message each viewer may see, per thread.
  const latest = await orm
    .selectDistinctOn([messages.threadId], { threadId: messages.threadId, body: messages.body, createdAt: messages.createdAt })
    .from(messages)
    .where(and(inArray(messages.threadId, ids), canSee))
    .orderBy(messages.threadId, desc(messages.createdAt));

  // Unread: messages from others since this person last opened the thread.
  const unread = await orm
    .select({ threadId: messages.threadId, count: sql<number>`count(*)::int` })
    .from(messages)
    .leftJoin(threadReads, and(eq(threadReads.threadId, messages.threadId), eq(threadReads.profileId, viewer.id)))
    .where(
      and(
        inArray(messages.threadId, ids),
        ne(messages.senderId, viewer.id),
        eq(messages.status, "delivered"),
        // A held message counts from when admin delivered it, not when it was written.
        or(
          sql`${threadReads.lastReadAt} is null`,
          gt(sql`coalesce(${messages.reviewedAt}, ${messages.createdAt})`, threadReads.lastReadAt),
        ),
      ),
    )
    .groupBy(messages.threadId);

  const summaries = await Promise.all(
    visible.map(async (thread) => {
      const last = latest.find((row) => row.threadId === thread.id);
      return {
        id: thread.id,
        kind: thread.kind,
        ...(await describeThread(viewer, thread)),
        lastMessage: last?.body ?? null,
        lastActivityAt: (last?.createdAt ?? thread.createdAt).toISOString(),
        unread: unread.find((row) => row.threadId === thread.id)?.count ?? 0,
        canPost: canPost(viewer, thread),
      };
    }),
  );
  return summaries.sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""));
}

/** Total unread messages, for the badge on home. */
export async function countUnread(user: SignedInUser): Promise<number> {
  const threadList = await listThreads(user);
  return threadList.reduce((total, thread) => total + thread.unread, 0);
}

export type ThreadView = {
  id: string;
  title: string;
  subtitle: string;
  canPost: boolean;
  /** True when a minor's parent is reading along without a seat. */
  readingAlong: boolean;
  messages: MessageView[];
};

/** One conversation, and marks it read. */
export async function openThread(user: SignedInUser, threadId: string, now: Date): Promise<ThreadView> {
  const viewer = await asViewer(user);
  const thread = await visibleThread(viewer, threadId);
  if (!thread) throw new MessagingError("This conversation isn't available.");

  const view = {
    id: thread.id,
    ...(await describeThread(viewer, thread)),
    canPost: canPost(viewer, thread),
    readingAlong: viewer.role === "client" && !thread.participantIds.includes(viewer.id),
    messages: await loadMessages(viewer, threadId),
  };
  await markRead(viewer.id, threadId, now);
  return view;
}

/** Just the messages, for the live-update poll. Checks access every time. */
export async function pollThread(user: SignedInUser, threadId: string, now: Date): Promise<MessageView[]> {
  const viewer = await asViewer(user);
  if (!(await visibleThread(viewer, threadId))) throw new MessagingError("This conversation isn't available.");
  const view = await loadMessages(viewer, threadId);
  await markRead(viewer.id, threadId, now);
  return view;
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export type SendResult = {
  messageId: string;
  status: "delivered" | "held";
  /** The database transaction id, for Neon Realtime's awaitTxId() later. */
  txid: string;
};

export async function sendMessage(user: SignedInUser, threadId: string, rawBody: string, now: Date): Promise<SendResult> {
  const viewer = await asViewer(user);
  const body = rawBody.trim();
  if (!body) throw new MessagingError("Write something first.");
  if (body.length > MAX_MESSAGE_LENGTH) throw new MessagingError(`Keep messages under ${MAX_MESSAGE_LENGTH} characters.`);

  const thread = await visibleThread(viewer, threadId);
  if (!thread) throw new MessagingError("This conversation isn't available.");
  if (!canPost(viewer, thread)) throw new MessagingError("You can read this conversation but not post in it.");

  // The contact filter. Admin's own messages are never held.
  const filter = viewer.role === "admin" ? { hold: false, reasons: [] } : checkForContactInfo(body);

  const [sent] = await orm
    .insert(messages)
    .values({
      threadId,
      senderId: viewer.id,
      body,
      flagged: filter.hold,
      status: filter.hold ? "held" : "delivered",
      flagReason: filter.hold ? filter.reasons.join(", ") : null,
    })
    .returning({ id: messages.id, status: messages.status, txid: sql<string>`pg_current_xact_id()::text` });

  await markRead(viewer.id, threadId, now);
  return { messageId: sent.id, status: sent.status === "held" ? "held" : "delivered", txid: sent.txid };
}

// ---------------------------------------------------------------------------
// Admin: the held-message queue
// ---------------------------------------------------------------------------

async function assertAdmin(user: SignedInUser) {
  if ((await roleOf(user.id)) !== "admin") throw new MessagingError("Only TutorMe staff can do that.");
}

export type HeldMessage = {
  id: string;
  threadId: string;
  threadTitle: string;
  body: string;
  flagReason: string | null;
  senderName: string;
  senderRole: Role;
  createdAt: string;
};

export async function listHeldMessages(user: SignedInUser): Promise<HeldMessage[]> {
  await assertAdmin(user);
  const viewer = await asViewer(user);
  const rows = await orm
    .select({ message: messages, senderName: profiles.name, senderRole: profiles.role, thread: threads })
    .from(messages)
    .innerJoin(profiles, eq(profiles.id, messages.senderId))
    .innerJoin(threads, eq(threads.id, messages.threadId))
    .where(eq(messages.status, "held"))
    .orderBy(messages.createdAt);

  return Promise.all(
    rows.map(async ({ message, senderName, senderRole, thread }) => ({
      id: message.id,
      threadId: thread.id,
      threadTitle: (await describeThread(viewer, thread)).title,
      body: message.body,
      flagReason: message.flagReason,
      senderName,
      senderRole,
      createdAt: message.createdAt.toISOString(),
    })),
  );
}

/** Admin delivers a held message as written, or rejects it (the sender sees "not delivered"). */
export async function reviewHeldMessage(user: SignedInUser, messageId: string, decision: "deliver" | "reject", now: Date): Promise<void> {
  await assertAdmin(user);
  const [updated] = await orm
    .update(messages)
    .set({ status: decision === "deliver" ? "delivered" : "rejected", reviewedBy: user.id, reviewedAt: now })
    .where(and(eq(messages.id, messageId), eq(messages.status, "held")))
    .returning({ id: messages.id });
  if (!updated) throw new MessagingError("This message was already reviewed.");
}
