"use client";

/** "Give <learner> their own login": asks for their email, makes an invite link. */
import { useActionState } from "react";

import styles from "@/components/paper/paper.module.css";

import { inviteLearnerAction, type FormState } from "./actions";

export function InviteLearnerForm({ learnerId, learnerName }: { learnerId: string; learnerName: string }) {
  const [state, formAction, isSaving] = useActionState<FormState, FormData>(inviteLearnerAction, {});

  return (
    <form action={formAction} className={styles.field}>
      <input type="hidden" name="learnerId" value={learnerId} />
      <label className={styles.field}>
        <span className={styles.label}>Give {learnerName} their own login</span>
        <input className={styles.input} type="email" name="email" placeholder="their email" required />
      </label>
      {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
      <button type="submit" className={styles.secondary} disabled={isSaving}>
        {isSaving ? "Making link…" : "Make invite link"}
      </button>
    </form>
  );
}
