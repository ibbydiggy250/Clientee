"use client";

/** A tutor accepts or declines a match request. */
import { useActionState } from "react";

import paper from "@/components/paper/paper.module.css";

import { respondAction, type MatchFormState } from "./actions";

export function RespondButtons({ requestId }: { requestId: string }) {
  const [state, formAction, isSaving] = useActionState<MatchFormState, FormData>(respondAction, {});

  if (state.message === "accept") return <p className={paper.note}>accepted ✓ — TutorMe will confirm the match</p>;
  if (state.message === "decline") return <p className={paper.note}>declined — they&apos;ll be matched with someone else</p>;

  return (
    <form action={formAction} className={paper.row}>
      <input type="hidden" name="requestId" value={requestId} />
      <button type="submit" name="decision" value="accept" className={paper.primary} disabled={isSaving}>
        Accept
      </button>
      <button type="submit" name="decision" value="decline" className={paper.secondary} disabled={isSaving}>
        Decline
      </button>
      {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
    </form>
  );
}
