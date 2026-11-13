"use client";

/**
 * Cancel with a second "are you sure?" step. When a family cancels inside
 * 24 hours, the confirm step says plainly that it will be charged.
 */
import { useActionState, useState } from "react";

import paper from "@/components/paper/paper.module.css";

import { cancelAction, type SessionFormState } from "./actions";

export function CancelButton({ sessionId, willBeCharged }: { sessionId: string; willBeCharged: boolean }) {
  const [state, formAction, isSaving] = useActionState<SessionFormState, FormData>(cancelAction, {});
  const [isConfirming, setIsConfirming] = useState(false);

  if (state.done) return <span className={paper.note}>{state.message ?? "Cancelled."}</span>;

  if (!isConfirming) {
    return (
      <button type="button" className={paper.secondary} onClick={() => setIsConfirming(true)}>
        Cancel
      </button>
    );
  }

  return (
    <form action={formAction} className={paper.row}>
      <input type="hidden" name="sessionId" value={sessionId} />
      {willBeCharged && <span className={paper.note}>under 24h — this will be charged</span>}
      <button type="submit" className={paper.primary} disabled={isSaving}>
        {isSaving ? "Cancelling…" : "Yes, cancel"}
      </button>
      <button type="button" className={paper.link} onClick={() => setIsConfirming(false)}>
        Keep it
      </button>
      {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
    </form>
  );
}
