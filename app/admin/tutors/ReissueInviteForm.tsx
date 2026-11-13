"use client";

/** For a tutor who hasn't joined: send a fresh invite, e.g. to a corrected email. */
import { useActionState } from "react";

import paper from "@/components/paper/paper.module.css";

import { CopyLink } from "../../home/CopyLink";
import { reissueTutorInviteAction, type AdminFormState } from "../actions";

type Props = { tutorId: string; currentEmail: string | null; origin: string };

export function ReissueInviteForm({ tutorId, currentEmail, origin }: Props) {
  const [state, formAction, isSaving] = useActionState<AdminFormState, FormData>(reissueTutorInviteAction, {});

  return (
    <form action={formAction} className={paper.fields}>
      <input type="hidden" name="tutorId" value={tutorId} />
      <label className={paper.field}>
        <span className={paper.label}>Send a new invite to</span>
        <input className={paper.input} type="email" name="email" defaultValue={currentEmail ?? ""} required />
        <span className={paper.hint}>The old link stops working.</span>
      </label>
      {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
      {state.inviteCode && <CopyLink label="New link for the tutor" url={`${origin}/invite/${state.inviteCode}`} />}
      <button type="submit" className={paper.secondary} disabled={isSaving}>
        {isSaving ? "Sending…" : "Make a new invite"}
      </button>
    </form>
  );
}
