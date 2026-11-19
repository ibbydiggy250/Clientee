"use client";

/** Admin delivers a held message as written, or rejects it. */
import { useActionState } from "react";

import paper from "@/components/paper/paper.module.css";

import { reviewHeldAction, type ReviewState } from "../../messages/actions";

export function ReviewButtons({ messageId }: { messageId: string }) {
  const [state, formAction, isSaving] = useActionState<ReviewState, FormData>(reviewHeldAction, {});

  if (state.done === "deliver") return <p className={paper.note}>delivered ✓</p>;
  if (state.done === "reject") return <p className={paper.note}>rejected — the sender sees &quot;not delivered&quot;</p>;

  return (
    <form action={formAction} className={paper.row}>
      <input type="hidden" name="messageId" value={messageId} />
      <button type="submit" name="decision" value="deliver" className={paper.primary} disabled={isSaving}>
        Deliver
      </button>
      <button type="submit" name="decision" value="reject" className={paper.secondary} disabled={isSaving}>
        Reject
      </button>
      {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
    </form>
  );
}
