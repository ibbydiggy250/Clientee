/**
 * Family desk → a learner's page, as the parent (or the learner) sees it:
 * learning numbers, their tutors with a Book link, goals, progress
 * (a placeholder for now) and the session history. The tutor's private
 * notes are not shown here.
 */
import Link from "next/link";

import desk from "@/components/desk/desk.module.css";
import paper from "@/components/paper/paper.module.css";
import { formatSessionTime } from "@/lib/eastern-time";
import type { FamilyLearnerPage } from "@/lib/learner-page";

import styles from "./learner.module.css";
import { LearnerHeader, NumberTiles, ProgressSketch, SessionTimeline } from "./LearnerPieces";

export function FamilyLearnerView({ page, now }: { page: FamilyLearnerPage; now: Date }) {
  const { learner, isMe, tutors, sessions, numbers } = page;
  const firstName = isMe ? "you" : learner.name.split(" ")[0];
  const upcoming = sessions.filter((item) => item.status === "scheduled" && item.startsAt > now);
  // Previous = anything that has already started (cancelled future sessions aren't shown).
  const past = sessions.filter((item) => item.startsAt <= now).reverse();
  const nextSession = upcoming[0];

  return (
    <div className={paper.sheet}>
      <LearnerHeader
        note={isMe ? "your learning" : "who's learning"}
        name={learner.name}
        details={learner.grade ?? ""}
        tags={learner.subjects}
      />

      {/* ---------- Learning numbers ---------- */}
      <section className={`${desk.panel} ${desk.panelGreen}`} aria-labelledby="numbers-heading">
        <h2 id="numbers-heading" className={desk.panelTab}>so far</h2>
        <NumberTiles
          tiles={[
            { label: "sessions done", value: numbers.completed },
            { label: "hours learned", value: numbers.hours },
            { label: "coming up", value: numbers.upcoming },
            { label: tutors.length === 1 ? "tutor" : "tutors", value: tutors.length },
          ]}
        />
        {nextSession && (
          <p className={styles.nextUp}>
            next up: <strong>{nextSession.subject}</strong> with {nextSession.tutorName}, {formatSessionTime(nextSession.startsAt)} ET
          </p>
        )}
      </section>

      <div className={desk.panelGrid}>
        {/* ---------- Their tutors ---------- */}
        <section className={`${desk.panel} ${desk.panelBlue}`} aria-labelledby="tutors-heading">
          <h2 id="tutors-heading" className={desk.panelTab}>{isMe ? "your tutors" : `${firstName}'s tutors`}</h2>
          {tutors.length === 0 ? (
            <p className={desk.emptyNote}>No tutor yet.</p>
          ) : (
            tutors.map((match) => (
              <div key={match.enrollmentId} className={desk.lineItem}>
                <span>
                  <strong>{match.subject}</strong> with {match.tutorName}
                  {match.inTrial && " · trial"}
                </span>
                <Link
                  className={`${paper.primary} ${paper.compact}`}
                  href={match.inTrial ? `/match/${learner.id}` : `/book/${match.enrollmentId}`}
                >
                  {match.inTrial ? "Trial" : "Book"}
                </Link>
              </div>
            ))
          )}
          {learner.accountId && (
            <Link className={paper.link} href={`/match/${learner.id}`}>
              {tutors.length ? "Find a tutor for another subject →" : "Find a tutor →"}
            </Link>
          )}
        </section>

        {/* ---------- Goals ---------- */}
        <section className={desk.panel} aria-labelledby="goals-heading">
          <h2 id="goals-heading" className={desk.panelTab}>goals</h2>
          {learner.goals ? <p className={styles.goal}>“{learner.goals}”</p> : <p className={desk.emptyNote}>No goal written yet.</p>}
          {learner.subjects.length > 0 && <p className={paper.hint}>Working on {learner.subjects.join(", ")}.</p>}
        </section>
      </div>

      {/* ---------- Progress (placeholder) ---------- */}
      <section className={`${desk.panel} ${desk.panelPaper}`} aria-labelledby="progress-heading">
        <h2 id="progress-heading" className={desk.panelTab}>progress</h2>
        <ProgressSketch caption={`Progress reports are on the way: after each session you'll see what ${firstName} worked on and how it's going.`} />
      </section>

      {/* ---------- Sessions ---------- */}
      <div className={desk.panelGrid}>
        <section className={desk.panel} aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className={desk.panelTab}>
            coming up {upcoming.length > 0 && <span className={desk.panelCount}>{upcoming.length}</span>}
          </h2>
          <SessionTimeline now={now} items={upcoming} who={(item) => item.tutorName} empty="Nothing booked yet." />
        </section>
        <section className={`${desk.panel} ${desk.panelPaper}`} aria-labelledby="past-heading">
          <h2 id="past-heading" className={desk.panelTab}>previous sessions</h2>
          <SessionTimeline now={now} items={past} who={(item) => item.tutorName} empty="No sessions yet." />
        </section>
      </div>
    </div>
  );
}
