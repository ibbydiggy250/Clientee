"use client";

/**
 * A tutor edits their whole profile: bio, intro-video link, fun fact, and
 * what they teach (subjects, levels, languages, school, style, goals, how many
 * learners they can take). Everything waits for admin approval before it
 * reaches families. (Weekly hours are separate and go live right away.)
 */
import { useActionState } from "react";

import desk from "@/components/desk/desk.module.css";
import { CheckboxPills } from "@/components/matching/CheckboxPills";
import paper from "@/components/paper/paper.module.css";
import { LEVELS, MAIN_GOALS, TEACHING_STYLES } from "@/lib/matching-options";
import type { ProfileDetails } from "@/lib/tutor-profile";

import admin from "../admin/admin.module.css";
import { saveProfileDraftAction, type MatchFormState } from "../match/actions";

export function ProfileDraftForm({ bio, introVideoUrl, details }: { bio: string; introVideoUrl: string; details: ProfileDetails }) {
  const [state, formAction, isSaving] = useActionState<MatchFormState, FormData>(saveProfileDraftAction, {});

  return (
    <form action={formAction} className={paper.fields}>
      <div className={desk.panelGrid}>
        {/* ---------- About you ---------- */}
        <section className={`${desk.panel} ${desk.panelPink}`} aria-labelledby="about-heading">
          <h2 id="about-heading" className={desk.panelTab}>about you</h2>
          <label className={paper.field}>
            <span className={paper.label}>Bio</span>
            <textarea
              className={paper.input}
              name="bio"
              defaultValue={bio}
              maxLength={1200}
              placeholder="How you teach, what you love about your subjects, your best tip for students…"
            />
            <span className={paper.hint}>No phone numbers, emails or social handles. All contact stays inside TutorMe.</span>
          </label>
          <label className={paper.field}>
            <span className={paper.label}>Interests or a fun fact</span>
            <input
              className={paper.input}
              name="funFact"
              defaultValue={details.funFact}
              maxLength={200}
              placeholder="e.g. I've solved a Rubik's cube in under a minute"
            />
          </label>
          <label className={paper.field}>
            <span className={paper.label}>Intro video link (optional)</span>
            <input className={paper.input} type="url" name="introVideoUrl" defaultValue={introVideoUrl} placeholder="https://…" />
          </label>
        </section>

        {/* ---------- What you teach ---------- */}
        <section className={`${desk.panel} ${desk.panelBlue}`} aria-labelledby="teach-heading">
          <h2 id="teach-heading" className={desk.panelTab}>what you teach</h2>
          <label className={paper.field}>
            <span className={paper.label}>Subjects</span>
            <input className={paper.input} name="subjects" defaultValue={details.subjects.join(", ")} placeholder="Algebra, Chemistry" />
            <span className={paper.hint}>Separate them with commas.</span>
          </label>
          <fieldset className={paper.field}>
            <legend className={paper.label}>Levels</legend>
            <CheckboxPills name="levels" options={LEVELS} checked={details.levels} />
          </fieldset>
          <label className={paper.field}>
            <span className={paper.label}>Languages you can teach in</span>
            <input className={paper.input} name="languages" defaultValue={details.languages.join(", ")} placeholder="English, Spanish" />
          </label>
          <div className={admin.inline}>
            <label className={paper.field}>
              <span className={paper.label}>School and year</span>
              <input className={paper.input} name="schoolYear" defaultValue={details.schoolYear} placeholder="e.g. NYU, sophomore" />
            </label>
            <label className={paper.field}>
              <span className={paper.label}>Max learners</span>
              <input className={paper.input} type="number" name="maxLearners" min={1} max={40} defaultValue={details.maxLearners} />
            </label>
          </div>
        </section>
      </div>

      {/* ---------- How you teach ---------- */}
      <section className={`${desk.panel} ${desk.panelPaper}`} aria-labelledby="style-heading">
        <h2 id="style-heading" className={desk.panelTab}>how you teach</h2>
        <fieldset className={paper.field}>
          <legend className={paper.label}>Teaching style</legend>
          <CheckboxPills name="teachingStyles" options={TEACHING_STYLES} checked={details.teachingStyles} />
        </fieldset>
        <fieldset className={paper.field}>
          <legend className={paper.label}>Good at helping with</legend>
          <CheckboxPills name="goalFocus" options={MAIN_GOALS} checked={details.goalFocus} />
        </fieldset>
      </section>

      {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
      {state.done && !state.error && <p className={paper.note}>sent to TutorMe for a quick check ✓</p>}
      <button type="submit" className={paper.primary} disabled={isSaving}>
        {isSaving ? "Sending…" : "Send for approval"}
      </button>
    </form>
  );
}
