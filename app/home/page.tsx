/**
 * Home for a signed-in client (parent or learner). Tutors see TutorHome and
 * admins see a link to the console instead.
 *
 * Everything here is read through `withUser`, so the database's row-level
 * security decides what this person sees: their own learners, their account,
 * and the invites they sent.
 */
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import Link from "next/link";

import { PaperPage, PenCircle } from "@/components/paper/PaperPage";
import styles from "@/components/paper/paper.module.css";
import { accounts, enrollments, invites, learners, profiles, tutors } from "@/db/schema";
import { requireProfile } from "@/lib/auth/current-user";
import { listVisibleSessions } from "@/lib/booking";
import { withUser } from "@/lib/db";
import { invitePath } from "@/lib/invites";
import { siteOrigin } from "@/lib/site-origin";

import { AddLearnerForm } from "./AddLearnerForm";
import { CopyLink } from "./CopyLink";
import { InviteLearnerForm } from "./InviteLearnerForm";
import { SessionList } from "../sessions/SessionList";
import { SignOutButton } from "./SignOutButton";
import { TutorHome } from "./TutorHome";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string; skipped?: string; moved?: string }>;
}) {
  const { user, profile } = await requireProfile();

  // Tutors and staff get their own home; everything below is for families.
  if (profile.role === "tutor") {
    return (
      <PaperPage action={<SignOutButton />}>
        <TutorHome profile={profile} />
      </PaperPage>
    );
  }
  if (profile.role === "admin") {
    return (
      <PaperPage action={<SignOutButton />}>
        <div className={`${styles.sheet} ${styles.narrow}`}>
          <p className={styles.note}>hi {profile.name.split(" ")[0].toLowerCase()} —</p>
          <h1 className={`${styles.title} ${styles.titleSmall}`}>You&apos;re signed in as staff.</h1>
          <Link className={styles.primary} href="/admin">
            Open the admin console
          </Link>
        </div>
      </PaperPage>
    );
  }

  const { myLearners, matchedLearnerIds, ownsAccount, sentInvites, bookableMatches } = await withUser(profile.id, async (tx) => {
    const myLearners = await tx.select().from(learners).orderBy(learners.createdAt);

    const learnerIds = myLearners.map((learner) => learner.id);
    const matches = learnerIds.length
      ? await tx
          .select({ learnerId: enrollments.learnerId })
          .from(enrollments)
          .where(inArray(enrollments.learnerId, learnerIds))
      : [];

    // Active matches with the tutor's name, for the "Book" links.
    const bookableMatches = learnerIds.length
      ? await tx
          .select({
            enrollmentId: enrollments.id,
            learnerId: enrollments.learnerId,
            subject: enrollments.subject,
            tutorName: profiles.name,
          })
          .from(enrollments)
          .innerJoin(tutors, eq(tutors.id, enrollments.tutorId))
          .innerJoin(profiles, eq(profiles.id, tutors.profileId))
          .where(and(eq(enrollments.status, "active"), inArray(enrollments.learnerId, learnerIds)))
      : [];

    const [account] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.ownerId, profile.id));
    const sentInvites = await tx
      .select()
      .from(invites)
      // Only invites that can still be accepted; expired ones aren't shown as live.
      .where(and(eq(invites.status, "pending"), gt(invites.expiresAt, sql`now()`)))
      .orderBy(desc(invites.createdAt));

    return {
      myLearners,
      matchedLearnerIds: new Set(matches.map((match) => match.learnerId)),
      ownsAccount: Boolean(account),
      sentInvites,
      bookableMatches,
    };
  });

  const now = new Date();
  const upcomingSessions = bookableMatches.length ? await listVisibleSessions(user, now) : [];
  const { booked, skipped, moved } = await searchParams;

  const origin = await siteOrigin();
  const firstName = profile.name.split(" ")[0];
  const pendingInviteFor = (learnerId: string) => sentInvites.find((invite) => invite.learnerId === learnerId);

  return (
    <PaperPage action={<SignOutButton />}>
      <div className={styles.sheet}>
        <p className={styles.note}>hi {firstName.toLowerCase()} —</p>
        <h1 className={styles.title}>
          Your{" "}
          <span className={styles.circled}>
            TutorMe
            <PenCircle />
          </span>
          , so far.
        </h1>
        <p className={styles.muted}>
          Once TutorMe matches a learner with a tutor, you can book sessions right here. Sessions are 60 minutes, Eastern
          time, and free to cancel or move up to 24 hours before.
        </p>

        {/* ---------- Just booked or moved ---------- */}
        {booked && (
          <p className={styles.note}>
            {booked === "1" ? "booked! ✓" : `booked ${booked} weekly sessions ✓`}
            {skipped && skipped !== "0" && ` (${skipped} week${skipped === "1" ? " was" : "s were"} already taken, so skipped)`}
          </p>
        )}
        {moved && <p className={styles.note}>moved ✓</p>}

        {/* ---------- Upcoming sessions ---------- */}
        {bookableMatches.length > 0 && (
          <section className={styles.fields} aria-labelledby="coming-up-heading">
            <h2 id="coming-up-heading" className={styles.heading}>Coming up</h2>
            <SessionList items={upcomingSessions} viewer="family" now={now} />
          </section>
        )}

        {/* ---------- Learners ---------- */}
        <section className={styles.fields} aria-labelledby="learners-heading">
          <h2 id="learners-heading" className={styles.heading}>
            {myLearners.length === 1 ? "Learner" : "Learners"}
          </h2>

          {myLearners.length === 0 && (
            <p className={styles.muted}>No learners yet. Add your first one below.</p>
          )}

          <div className={styles.cardGrid}>
            {myLearners.map((learner) => {
              const isMe = learner.profileId === user.id;
              const invite = pendingInviteFor(learner.id);
              return (
                <article key={learner.id} className={styles.card}>
                  {!learner.accountId ? (
                    <span className={`${styles.stamp} ${styles.stampWaiting}`}>Waiting for a parent</span>
                  ) : matchedLearnerIds.has(learner.id) ? (
                    <span className={`${styles.stamp} ${styles.stampDone}`}>Matched</span>
                  ) : (
                    <span className={`${styles.stamp} ${styles.stampWaiting}`}>Awaiting tutor match</span>
                  )}
                  <h3 className={styles.choiceTitle}>
                    {learner.name}
                    {isMe && " (you)"}
                  </h3>
                  <p className={styles.muted}>
                    {[learner.grade, learner.subjects.join(", ")].filter(Boolean).join(" · ") || "No details yet"}
                  </p>
                  {learner.goals && <p>{learner.goals}</p>}

                  {/* One "Book" link per active match */}
                  {bookableMatches
                    .filter((match) => match.learnerId === learner.id)
                    .map((match) => (
                      <Link key={match.enrollmentId} className={styles.primary} href={`/book/${match.enrollmentId}`}>
                        Book {match.subject} with {match.tutorName.split(" ")[0]}
                      </Link>
                    ))}

                  {/* A minor waiting on their parent: show the link to send */}
                  {isMe && invite?.kind === "parent" && (
                    <CopyLink label="Send this link to your parent" url={origin + invitePath(invite.code)} />
                  )}

                  {/* Account holder: give a learner their own login */}
                  {ownsAccount && !isMe && !learner.profileId && (
                    invite?.kind === "learner" ? (
                      <CopyLink label={`Send this link to ${learner.name}`} url={origin + invitePath(invite.code)} />
                    ) : (
                      <InviteLearnerForm learnerId={learner.id} learnerName={learner.name} />
                    )
                  )}
                  {!isMe && learner.profileId && <p className={styles.hint}>Has their own login.</p>}
                </article>
              );
            })}
          </div>
        </section>

        {/* ---------- Add a learner ---------- */}
        {ownsAccount && (
          <section className={styles.fields} aria-labelledby="add-heading">
            <h2 id="add-heading" className={styles.heading}>Add a learner</h2>
            <AddLearnerForm />
          </section>
        )}
      </div>
    </PaperPage>
  );
}
