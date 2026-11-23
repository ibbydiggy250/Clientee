/**
 * Clientee → a learner's file, as their tutor sees it: teaching numbers,
 * who they are and what the family wants, the tutor's own notes per subject,
 * progress (a placeholder for now), and every session together.
 */
import desk from "@/components/desk/desk.module.css";
import paper from "@/components/paper/paper.module.css";
import { formatSessionTime } from "@/lib/eastern-time";
import type { TutorLearnerPage } from "@/lib/learner-page";
import { MAIN_GOALS, TEACHING_STYLES } from "@/lib/matching-options";
import { familyNotes } from "@/lib/tutor-desk";

import styles from "./learner.module.css";
import { LearnerNotesForm } from "./LearnerNotesForm";
import { LearnerHeader, NumberTiles, ProgressSketch, SessionTimeline } from "./LearnerPieces";

export function TutorLearnerView({ page, now }: { page: TutorLearnerPage; now: Date }) {
  const { learner, subjects, sessions, numbers, notes } = page;
  const upcoming = sessions.filter((item) => item.status === "scheduled" && item.startsAt > now);
  // Previous = anything that has already started (cancelled future sessions aren't shown).
  const past = sessions.filter((item) => item.startsAt <= now).reverse();
  const nextSession = upcoming[0];
  const preferences = learner.preferences ?? {};
  const style = TEACHING_STYLES.find((option) => option.value === preferences.teachingStyle)?.label;
  const goal = MAIN_GOALS.find((option) => option.value === preferences.mainGoal)?.label;
  const notesFromFamily = familyNotes(learner.preferences);

  return (
    <div className={paper.sheet}>
      <LearnerHeader
        note="clientee · learner file"
        name={learner.name}
        details={learner.grade ?? ""}
        tags={subjects.map((subject) => `${subject.subject}${subject.inTrial ? " · trial" : ""}`)}
      />

      {/* ---------- Teaching numbers ---------- */}
      <section className={`${desk.panel} ${desk.panelGreen}`} aria-labelledby="numbers-heading">
        <h2 id="numbers-heading" className={desk.panelTab}>at a glance</h2>
        <NumberTiles
          tiles={[
            { label: "sessions taught", value: numbers.completed },
            { label: "hours together", value: numbers.hours },
            { label: "attendance", value: numbers.attendancePercent === null ? "–" : `${numbers.attendancePercent}%` },
            { label: "no-shows", value: numbers.noShows },
            { label: "booked ahead", value: numbers.upcoming },
          ]}
        />
        {nextSession && (
          <p className={styles.nextUp}>
            next up: <strong>{nextSession.subject}</strong>, {formatSessionTime(nextSession.startsAt)} ET
          </p>
        )}
      </section>

      <div className={desk.panelGrid}>
        {/* ---------- Who they are ---------- */}
        <section className={`${desk.panel} ${desk.panelBlue}`} aria-labelledby="about-heading">
          <h2 id="about-heading" className={desk.panelTab}>about {learner.name.split(" ")[0]}</h2>
          <dl className={styles.facts}>
            <dt>Goal</dt>
            <dd>{learner.goals || "Not written yet"}</dd>
            {learner.baseline && (
              <>
                <dt>Starting point</dt>
                <dd>{learner.baseline}</dd>
              </>
            )}
            {goal && (
              <>
                <dt>Main focus</dt>
                <dd>{goal}</dd>
              </>
            )}
            {style && (
              <>
                <dt>Learns best with</dt>
                <dd>{style}</dd>
              </>
            )}
          </dl>
          {notesFromFamily && <blockquote className={styles.familyQuote}>“{notesFromFamily}”<cite>the family</cite></blockquote>}
        </section>

        {/* ---------- Progress (placeholder) ---------- */}
        <section className={`${desk.panel} ${desk.panelPaper}`} aria-labelledby="progress-heading">
          <h2 id="progress-heading" className={desk.panelTab}>progress</h2>
          <ProgressSketch caption="Once session notes arrive, this charts how they're doing session by session, so you can see the trend at a glance." />
        </section>
      </div>

      {/* ---------- The tutor's notes, one compartment per subject ---------- */}
      {notes.map((note) => (
        <section key={note.subject} className={`${desk.panel} ${desk.panelPink}`} aria-labelledby={`notes-${note.subject}`}>
          <h2 id={`notes-${note.subject}`} className={desk.panelTab}>your notes · {note.subject.toLowerCase()}</h2>
          {note.updatedAt && (
            <p className={desk.panelHint}>Last updated {note.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}</p>
          )}
          <LearnerNotesForm
            learnerId={learner.id}
            subject={note.subject}
            strengths={note.strengths}
            weaknesses={note.weaknesses}
            nextFocus={note.nextFocus}
          />
        </section>
      ))}

      {/* ---------- Sessions ---------- */}
      <div className={desk.panelGrid}>
        <section className={desk.panel} aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className={desk.panelTab}>
            coming up {upcoming.length > 0 && <span className={desk.panelCount}>{upcoming.length}</span>}
          </h2>
          <SessionTimeline now={now} items={upcoming} who={() => learner.name} empty="Nothing booked yet." />
        </section>
        <section className={`${desk.panel} ${desk.panelPaper}`} aria-labelledby="past-heading">
          <h2 id="past-heading" className={desk.panelTab}>previous sessions</h2>
          <SessionTimeline now={now} items={past} who={() => learner.name} empty="No sessions yet." />
        </section>
      </div>
    </div>
  );
}
