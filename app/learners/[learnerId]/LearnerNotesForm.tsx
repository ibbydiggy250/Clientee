"use client";

/** The tutor's working notes on a learner for one subject: strengths, things to work on, next focus. */
import { useActionState } from "react";

import paper from "@/components/paper/paper.module.css";

import { saveLearnerNotesAction, type LearnerFormState } from "../actions";
import styles from "./learner.module.css";

type Props = {
  learnerId: string;
  subject: string;
  strengths: string;
  weaknesses: string;
  nextFocus: string;
};

export function LearnerNotesForm({ learnerId, subject, strengths, weaknesses, nextFocus }: Props) {
  const [state, formAction, isSaving] = useActionState<LearnerFormState, FormData>(saveLearnerNotesAction, {});

  return (
    <form action={formAction} className={styles.notesForm}>
      <input type="hidden" name="learnerId" value={learnerId} />
      <input type="hidden" name="subject" value={subject} />
      <label className={`${paper.field} ${styles.noteStrengths}`}>
        <span className={styles.noteLabel}>strengths ✓</span>
        <textarea className={paper.input} name="strengths" defaultValue={strengths} maxLength={1500} placeholder="What clicks for them…" />
      </label>
      <label className={`${paper.field} ${styles.noteWeaknesses}`}>
        <span className={styles.noteLabel}>to work on ✗</span>
        <textarea className={paper.input} name="weaknesses" defaultValue={weaknesses} maxLength={1500} placeholder="Where they get stuck…" />
      </label>
      <label className={`${paper.field} ${styles.noteFocus}`}>
        <span className={styles.noteLabel}>next session →</span>
        <textarea className={paper.input} name="nextFocus" defaultValue={nextFocus} maxLength={1500} placeholder="What to cover next time…" />
      </label>
      <div className={styles.notesFooter}>
        {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
        {state.done && !state.error && <p className={paper.note}>saved ✓</p>}
        <button type="submit" className={`${paper.secondary} ${paper.compact}`} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save notes"}
        </button>
        <span className={paper.hint}>Private to tutors and TutorMe. Families don&apos;t see these.</span>
      </div>
    </form>
  );
}
