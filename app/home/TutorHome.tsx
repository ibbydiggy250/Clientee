/**
 * Home for a tutor: the first, small piece of Clientee.
 * Shows their contract and the learners admin has matched them with.
 *
 * Read through `withUser`, so row-level security limits it to their own
 * active matches, and only while their contract allows (see migration 0005).
 */
import { eq } from "drizzle-orm";

import { PenCircle } from "@/components/paper/PaperPage";
import styles from "@/components/paper/paper.module.css";
import { enrollments, learners, tutors } from "@/db/schema";
import type { Profile } from "@/lib/auth/current-user";
import { withUser } from "@/lib/db";

function formatDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
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
      })
      .from(enrollments)
      .innerJoin(learners, eq(learners.id, enrollments.learnerId))
      .where(eq(enrollments.status, "active"))
      .orderBy(learners.name);

    return { tutor, matches };
  });

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
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
