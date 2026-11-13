"use client";

/** Admin approves or turns down an accepted match request. */
import { useActionState } from "react";

import paper from "@/components/paper/paper.module.css";

import { decideMatchAction, type MatchFormState } from "../match/actions";

export function DecideMatchButtons({ requestId, canApprove }: { requestId: string; canApprove: boolean }) {
  const [state, formAction, isSaving] = useActionState<MatchFormState, FormData>(decideMatchAction, {});

  if (state.message === "approve") return <p className={paper.note}>approved ✓ — trial unlocked</p>;
  if (state.message === "reject") return <p className={paper.note}>turned down</p>;

  return (
    <form action={formAction} className={paper.row}>
      <input type="hidden" name="requestId" value={requestId} />
      {canApprove && (
        <button type="submit" name="decision" value="approve" className={paper.primary} disabled={isSaving}>
          Approve
        </button>
      )}
      <button type="submit" name="decision" value="reject" className={paper.secondary} disabled={isSaving}>
        Decline
      </button>
      {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
    </form>
  );
}
