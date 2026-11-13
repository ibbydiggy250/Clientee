"use client";

/** Small forms on the "Find a tutor" page: request a tutor, and the trial result. */
import { useActionState } from "react";

import paper from "@/components/paper/paper.module.css";

import { requestTutorAction, trialResultAction, type MatchFormState } from "../actions";

export function RequestButton({ requestId, learnerId, tutorName, primary }: { requestId: string; learnerId: string; tutorName: string; primary: boolean }) {
  const [state, formAction, isSaving] = useActionState<MatchFormState, FormData>(requestTutorAction, {});
  return (
    <form action={formAction} className={paper.fields}>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="learnerId" value={learnerId} />
      {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
      <button type="submit" className={primary ? paper.primary : paper.secondary} disabled={isSaving}>
        {isSaving ? "Sending…" : `Request ${tutorName.split(" ")[0]}`}
      </button>
    </form>
  );
}

export function TrialResultButtons({ enrollmentId, learnerId, tutorName }: { enrollmentId: string; learnerId: string; tutorName: string }) {
  const [state, formAction, isSaving] = useActionState<MatchFormState, FormData>(trialResultAction, {});

  if (state.message === "good") return <p className={paper.note}>wonderful — weekly booking is open ✓</p>;
  if (state.message === "not") return <p className={paper.note}>noted — let&apos;s find someone who fits better ↓</p>;

  return (
    <form action={formAction} className={paper.fields}>
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <input type="hidden" name="learnerId" value={learnerId} />
      <span className={paper.label}>How was the trial with {tutorName}?</span>
      <div className={paper.row}>
        <button type="submit" name="result" value="good" className={paper.primary} disabled={isSaving}>
          Good fit — keep going
        </button>
        <button type="submit" name="result" value="not" className={paper.secondary} disabled={isSaving}>
          Not a fit
        </button>
      </div>
      <span className={paper.hint}>&quot;Not a fit&quot; ends this match and cancels any other booked sessions with {tutorName}, free of charge.</span>
      {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
    </form>
  );
}
