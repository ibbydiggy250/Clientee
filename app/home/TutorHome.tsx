/**
 * Home for a tutor: the first, small piece of Clientee.
 * Shows their contract and the learners admin has matched them with.
 *
 * Read through `withUser`, so row-level security limits it to their own
 * active matches, and only while their contract allows (see migration 0005).
 */
import { eq } from "drizzle-orm";
import Link from "next/link";

import { PenCircle } from "@/components/paper/PaperPage";
import styles from "@/components/paper/paper.module.css";
import { enrollments, learners, tutors } from "@/db/schema";
import type { Profile } from "@/lib/auth/current-user";
import { listVisibleSessions } from "@/lib/booking";
import { withUser } from "@/lib/db";
import { formatSessionTime } from "@/lib/eastern-time";
import { getTutorRequests } from "@/lib/matching";

import { RespondButtons } from "../match/RespondButtons";
import { SessionList } from "../sessions/SessionList";

function formatDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** The free-text notes a family left when finding a tutor, if any. */
function familyNotes(preferences: unknown): string {
  const notes = (preferences as { notes?: unknown } | null)?.notes;
  return typeof notes === "string" ? notes.trim() : "";
}

export async function TutorHome({ profile }: { profile: Profile }) {
  const { tutor, matches } = await withUser(profile.id, async (tx) => {
    // Only the columns tutors (and matched families) may read.
    const [tutor] = await tx
      .select({ status: tutors.status, subjects: tutors.subjects, termStart: tutors.termStart, termEnd: tutors.termEnd })
      .from(tutors)
      .where(eq(tutors.profileId, profile.id));

    const matches = await tx
      .select({
        id: enrollments.id,
        subject: enrollments.subject,
        learnerName: learners.name,
        grade: learners.grade,
        goals: learners.goals,
        // The family's free-text notes. Tutors only see learners after admin
        // approves the match, which is when these notes may be shared.
        preferences: learners.preferences,
      })
      .from(enrollments)
      .innerJoin(learners, eq(learners.id, enrollments.learnerId))
      .where(eq(enrollments.status, "active"))
      .orderBy(learners.name);

    return { tutor, matches };
  });

  const now = new Date();
  const me = { id: profile.id, email: profile.email, name: profile.name };
  const sessionsToShow = await listVisibleSessions(me, now);
  const requests = await getTutorRequests(me, now);

  const firstName = profile.name.split(" ")[0];
  const hasEnded = tutor?.status === "inactive";

  return (
    <div className={styles.sheet}>
      <p className={styles.note}>clientee · hi {firstName.toLowerCase()} —</p>
      <h1 className={styles.title}>
        Your{" "}
        <span className={styles.circled}>
          learners.
          <PenCircle />
        </span>
      </h1>
      <p className={styles.muted}>
        Contract: {formatDate(tutor?.termStart ?? null)} → {formatDate(tutor?.termEnd ?? null)}
        {tutor?.subjects.length ? ` · ${tutor.subjects.join(", ")}` : ""}
      </p>

      {/* ---------- New match requests (48 hours to answer) ---------- */}
      {!hasEnded && requests.length > 0 && (
        <section className={styles.fields} aria-labelledby="requests-heading">
          <h2 id="requests-heading" className={styles.note}>a family would like to work with you ↓</h2>
          <div className={styles.cardGrid}>
            {requests.map((request) => (
              <article key={request.id} className={`${styles.card} ${styles.formCard}`}>
                <span className={`${styles.stamp} ${styles.stampWaiting}`}>
                  Answer by {request.expiresAt ? formatSessionTime(request.expiresAt) : "soon"} ET
                </span>
                <h3 className={styles.choiceTitle}>{request.learnerFirstName}</h3>
                <p className={styles.muted}>
                  {[request.subject, request.level, request.grade].filter(Boolean).join(" · ")}
                </p>
                {(request.mainGoal || request.teachingStyle) && (
                  <p>{[request.mainGoal, request.teachingStyle].filter(Boolean).join(" · ")}</p>
                )}
                <RespondButtons requestId={request.id} />
              </article>
            ))}
          </div>
        </section>
      )}

      {!hasEnded && (
        <Link className={styles.link} href="/profile">
          Your public profile (what families see) →
        </Link>
      )}

      {!hasEnded && (
        <section className={styles.fields} aria-labelledby="schedule-heading">
          <div className={styles.row}>
            <h2 id="schedule-heading" className={styles.heading}>Your schedule</h2>
            <Link className={styles.secondary} href="/availability">
              Set your weekly hours
            </Link>
          </div>
          <SessionList items={sessionsToShow} viewer="tutor" now={now} />
        </section>
      )}

      {hasEnded ? (
        <p className={styles.error}>Your contract has ended. Contact TutorMe if this is a mistake.</p>
      ) : matches.length === 0 ? (
        <p className={styles.muted}>No learners yet. TutorMe will match families with you soon.</p>
      ) : (
        <div className={styles.cardGrid}>
          {matches.map((match) => (
            <article key={match.id} className={styles.card}>
              <span className={`${styles.stamp} ${styles.stampDone}`}>{match.subject}</span>
              <h2 className={styles.choiceTitle}>{match.learnerName}</h2>
              {match.grade && <p className={styles.muted}>{match.grade}</p>}
              {match.goals && <p>{match.goals}</p>}
              {familyNotes(match.preferences) && (
                <p className={styles.muted}>Family&apos;s notes: “{familyNotes(match.preferences)}”</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
