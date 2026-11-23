/**
 * Clientee → Learners: the learners admin has matched with this tutor.
 * Each card opens that learner's file (/learners/<id>). (Moved from the old tutor home.)
 */
import Link from "next/link";

import desk from "@/components/desk/desk.module.css";
import styles from "@/components/paper/paper.module.css";
import { familyNotes, type TutorDesk } from "@/lib/tutor-desk";

export function TutorLearners({ desk: data }: { desk: TutorDesk }) {
  return (
    <div className={styles.sheet}>
      <header className={desk.pageHead}>
        <p className={styles.note}>clientee · who you teach</p>
        <h1 className={desk.pageTitle}>Learners.</h1>
      </header>

      {data.contractEnded ? (
        <p className={styles.error}>Your contract has ended. Contact TutorMe if this is a mistake.</p>
      ) : data.matches.length === 0 ? (
        <p className={styles.muted}>No learners yet. TutorMe will match families with you soon.</p>
      ) : (
        <div className={styles.cardGrid}>
          {data.matches.map((match) => (
            <Link
              key={match.id}
              href={`/learners/${match.learnerId}`}
              className={`${styles.card} ${styles.formCard} ${styles.choice}`}
              aria-label={`Open ${match.learnerName}'s learner file (${match.subject})`}
            >
              <span className={`${styles.stamp} ${styles.stampDone}`}>
                {match.subject}
                {match.inTrial && " · trial"}
              </span>
              <h2 className={styles.choiceTitle}>{match.learnerName}</h2>
              {match.grade && <p className={styles.muted}>{match.grade}</p>}
              {match.goals && <p>{match.goals}</p>}
              {familyNotes(match.preferences) && (
                <p className={styles.muted}>Family&apos;s notes: “{familyNotes(match.preferences)}”</p>
              )}
              <span className={desk.margin}>open learner file →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
