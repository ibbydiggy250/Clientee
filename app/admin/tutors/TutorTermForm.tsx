"use client";

/** Extend or end a tutor's contract, or change their status. */
import { useActionState } from "react";

import paper from "@/components/paper/paper.module.css";

import { updateTutorTermAction, type AdminFormState } from "../actions";
import styles from "../admin.module.css";

type Props = {
  tutorId: string;
  termEnd: string | null;
  status: "active" | "offboarding" | "inactive";
};

export function TutorTermForm({ tutorId, termEnd, status }: Props) {
  const [state, formAction, isSaving] = useActionState<AdminFormState, FormData>(updateTutorTermAction, {});

  return (
    <form action={formAction} className={paper.fields}>
      <input type="hidden" name="tutorId" value={tutorId} />
      <div className={styles.inline}>
        <label className={paper.field}>
          <span className={paper.label}>Contract ends</span>
          <input className={paper.input} type="date" name="termEnd" defaultValue={termEnd ?? ""} required />
        </label>
        <label className={paper.field}>
          <span className={paper.label}>Status</span>
          <select className={styles.select} name="status" defaultValue={status}>
            <option value="active">Active</option>
            <option value="offboarding">Offboarding (read-only, ~7 days)</option>
            <option value="inactive">Inactive (signed out, blocked)</option>
          </select>
        </label>
      </div>
      {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
      {state.done && !state.error && <p className={paper.note}>saved ✓</p>}
      <button type="submit" className={paper.secondary} disabled={isSaving}>
        {isSaving ? "Saving…" : "Save contract"}
      </button>
    </form>
  );
}
