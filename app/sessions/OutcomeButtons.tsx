"use client";

/** After a session ends, the tutor records whether it happened. */
import { useActionState } from "react";

import booking from "@/components/booking/booking.module.css";
import paper from "@/components/paper/paper.module.css";

import { outcomeAction, type SessionFormState } from "./actions";

export function OutcomeButtons({ sessionId }: { sessionId: string }) {
  const [state, formAction, isSaving] = useActionState<SessionFormState, FormData>(outcomeAction, {});

  return (
    <form action={formAction} className={booking.sessionActions}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <button type="submit" name="outcome" value="completed" className={`${paper.primary} ${paper.compact}`} disabled={isSaving}>
        It happened ✓
      </button>
      <button type="submit" name="outcome" value="no_show" className={`${paper.secondary} ${paper.compact}`} disabled={isSaving}>
        No-show
      </button>
      {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
    </form>
  );
}
