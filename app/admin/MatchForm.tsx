"use client";

/**
 * Matches one learner with a tutor for one subject.
 * Picking the tier fills in the usual rate (spec: ~$60 standard, $80+ AP/SAT);
 * admin can still change it.
 */
import { useActionState, useState } from "react";

import paper from "@/components/paper/paper.module.css";
import type { MatchableTutor } from "@/lib/admin";

import { matchLearnerAction, type AdminFormState } from "./actions";
import styles from "./admin.module.css";

const usualRate = { standard: 60, premium: 80 } as const;

type Props = {
  learnerId: string;
  learnerName: string;
  suggestedSubjects: string[];
  tutors: MatchableTutor[];
};

export function MatchForm({ learnerId, learnerName, suggestedSubjects, tutors }: Props) {
  const [state, formAction, isSaving] = useActionState<AdminFormState, FormData>(matchLearnerAction, {});
  const [tier, setTier] = useState<"standard" | "premium">("standard");
  const [rate, setRate] = useState<number>(usualRate.standard);
  const subjectListId = `subjects-${learnerId}`;

  if (tutors.length === 0) {
    return <p className={styles.small}>No active tutors yet. Invite one on the Tutors tab first.</p>;
  }

  return (
    <form action={formAction} className={paper.fields}>
      <input type="hidden" name="learnerId" value={learnerId} />
      <div className={styles.inline}>
        <label className={paper.field}>
          <span className={paper.label}>Tutor</span>
          <select className={styles.select} name="tutorId" required defaultValue="">
            <option value="" disabled>Pick a tutor…</option>
            {tutors.map((tutor) => (
              <option key={tutor.id} value={tutor.id}>
                {tutor.name}
                {tutor.subjects.length > 0 && ` — ${tutor.subjects.join(", ")}`}
              </option>
            ))}
          </select>
        </label>
        <label className={paper.field}>
          <span className={paper.label}>Subject</span>
          <input className={paper.input} name="subject" list={subjectListId} required defaultValue={suggestedSubjects[0] ?? ""} />
          <datalist id={subjectListId}>
            {suggestedSubjects.map((subject) => (
              <option key={subject} value={subject} />
            ))}
          </datalist>
        </label>
        <label className={paper.field}>
          <span className={paper.label}>Tier</span>
          <select
            className={styles.select}
            name="tier"
            value={tier}
            onChange={(event) => {
              const next = event.target.value as "standard" | "premium";
              setTier(next);
              setRate(usualRate[next]);
            }}
          >
            <option value="standard">Standard</option>
            <option value="premium">Premium (AP / SAT)</option>
          </select>
        </label>
        <label className={paper.field}>
          <span className={paper.label}>Rate, $ per hour</span>
          <input
            className={paper.input}
            name="rateDollars"
            type="number"
            min={1}
            step="0.01"
            value={rate}
            onChange={(event) => setRate(Number(event.target.value))}
            required
          />
        </label>
      </div>
      {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
      <button type="submit" className={paper.primary} disabled={isSaving}>
        {isSaving ? "Matching…" : `Match ${learnerName.split(" ")[0]}`}
      </button>
    </form>
  );
}
