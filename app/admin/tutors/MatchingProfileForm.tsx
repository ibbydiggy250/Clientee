"use client";

/**
 * Admin sets a tutor's matching profile: levels, school/year, learner cap,
 * birth date, gender, teaching styles, goals they're good at. A tutor with no
 * levels or birth date never appears in suggestions.
 */
import { useActionState } from "react";

import matching from "@/components/matching/matching.module.css";
import paper from "@/components/paper/paper.module.css";
import type { RosterTutor } from "@/lib/admin";
import { LEVELS, MAIN_GOALS, TEACHING_STYLES } from "@/lib/matching-options";

import { updateMatchingProfileAction, type MatchFormState } from "../../match/actions";
import styles from "../admin.module.css";

function CheckboxPills({ name, options, checked }: { name: string; options: readonly { value: string; label: string }[]; checked: string[] }) {
  return (
    <div className={matching.pills}>
      {options.map((option) => (
        <label key={option.value} className={matching.pill}>
          <input type="checkbox" name={name} value={option.value} defaultChecked={checked.includes(option.value)} />
          {option.label}
        </label>
      ))}
    </div>
  );
}

export function MatchingProfileForm({ tutorId, profile }: { tutorId: string; profile: RosterTutor["matching"] }) {
  const [state, formAction, isSaving] = useActionState<MatchFormState, FormData>(updateMatchingProfileAction, {});

  return (
    <form action={formAction} className={paper.fields}>
      <input type="hidden" name="tutorId" value={tutorId} />
      <fieldset className={paper.field}>
        <legend className={paper.label}>Levels they teach</legend>
        <CheckboxPills name="levels" options={LEVELS} checked={profile.levels} />
      </fieldset>
      <div className={styles.inline}>
        <label className={paper.field}>
          <span className={paper.label}>School and year (public)</span>
          <input className={paper.input} name="schoolYear" defaultValue={profile.schoolYear ?? ""} placeholder="e.g. NYU, sophomore" />
        </label>
        <label className={paper.field}>
          <span className={paper.label}>Max learners</span>
          <input className={paper.input} type="number" name="maxLearners" min={1} max={40} defaultValue={profile.maxLearners} />
        </label>
        <label className={paper.field}>
          <span className={paper.label}>Birth date (private)</span>
          <input className={paper.input} type="date" name="birthDate" defaultValue={profile.birthDate ?? ""} />
        </label>
        <label className={paper.field}>
          <span className={paper.label}>Gender (private)</span>
          <select className={styles.select} name="gender" defaultValue={profile.gender ?? ""}>
            <option value="">Not given</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
      </div>
      <fieldset className={paper.field}>
        <legend className={paper.label}>Teaching style</legend>
        <CheckboxPills name="teachingStyles" options={TEACHING_STYLES} checked={profile.teachingStyles} />
      </fieldset>
      <fieldset className={paper.field}>
        <legend className={paper.label}>Good at helping with</legend>
        <CheckboxPills name="goalFocus" options={MAIN_GOALS} checked={profile.goalFocus} />
      </fieldset>
      {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
      {state.done && !state.error && <p className={paper.note}>saved ✓</p>}
      <button type="submit" className={paper.secondary} disabled={isSaving}>
        {isSaving ? "Saving…" : "Save matching profile"}
      </button>
    </form>
  );
}
