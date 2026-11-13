"use client";

/** Admin sends a tutor an invite after the contract is signed. */
import { useActionState } from "react";

import paper from "@/components/paper/paper.module.css";

import { CopyLink } from "../../home/CopyLink";
import { inviteTutorAction, type AdminFormState } from "../actions";
import styles from "../admin.module.css";

export function InviteTutorForm({ origin }: { origin: string }) {
  const [state, formAction, isSaving] = useActionState<AdminFormState, FormData>(inviteTutorAction, {});

  return (
    <form action={formAction} className={`${paper.card} ${paper.formCard} ${paper.fields}`}>
      <label className={paper.field}>
        <span className={paper.label}>Tutor&apos;s email</span>
        <input className={paper.input} type="email" name="email" required autoComplete="off" />
      </label>
      <label className={paper.field}>
        <span className={paper.label}>Subjects</span>
        <input className={paper.input} name="subjects" placeholder="e.g. AP Chemistry, SAT Math" autoComplete="off" />
        <span className={paper.hint}>Separate them with commas.</span>
      </label>
      <div className={styles.inline}>
        <label className={paper.field}>
          <span className={paper.label}>Contract starts</span>
          <input className={paper.input} type="date" name="termStart" required />
        </label>
        <label className={paper.field}>
          <span className={paper.label}>Contract ends</span>
          <input className={paper.input} type="date" name="termEnd" required />
        </label>
      </div>
      {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
      {state.inviteCode && (
        <CopyLink label="Send this link to the tutor" url={`${origin}/invite/${state.inviteCode}`} />
      )}
      <button type="submit" className={paper.primary} disabled={isSaving}>
        {isSaving ? "Making invite…" : "Invite tutor"}
      </button>
    </form>
  );
}
