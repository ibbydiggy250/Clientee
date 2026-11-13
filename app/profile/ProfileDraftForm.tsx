"use client";

/** A tutor edits their bio and intro-video link. Changes wait for admin approval. */
import { useActionState } from "react";

import paper from "@/components/paper/paper.module.css";

import { saveProfileDraftAction, type MatchFormState } from "../match/actions";

export function ProfileDraftForm({ bio, introVideoUrl }: { bio: string; introVideoUrl: string }) {
  const [state, formAction, isSaving] = useActionState<MatchFormState, FormData>(saveProfileDraftAction, {});

  return (
    <form action={formAction} className={`${paper.card} ${paper.formCard} ${paper.fields}`}>
      <label className={paper.field}>
        <span className={paper.label}>Bio</span>
        <textarea
          className={paper.input}
          name="bio"
          defaultValue={bio}
          maxLength={1200}
          placeholder="How you teach, what you love about your subjects, your best tip for students…"
        />
        <span className={paper.hint}>No phone numbers, emails or social handles — all contact stays inside TutorMe.</span>
      </label>
      <label className={paper.field}>
        <span className={paper.label}>Intro video link (optional)</span>
        <input className={paper.input} type="url" name="introVideoUrl" defaultValue={introVideoUrl} placeholder="https://…" />
      </label>
      {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
      {state.done && !state.error && <p className={paper.note}>sent to TutorMe for a quick check ✓</p>}
      <button type="submit" className={paper.primary} disabled={isSaving}>
        {isSaving ? "Sending…" : "Send for approval"}
      </button>
    </form>
  );
}
