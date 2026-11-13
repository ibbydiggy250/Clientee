"use client";

/**
 * "What does {learner} need?" — subject, level, weekly times and preferences.
 * Saved answers pre-fill the form next time.
 */
import { startTransition, useActionState, useState, type FormEvent } from "react";

import admin from "@/app/admin/admin.module.css";
import matching from "@/components/matching/matching.module.css";
import paper from "@/components/paper/paper.module.css";
import { formatClock, WEEKDAY_NAMES } from "@/lib/eastern-time";
import { LEVELS, MAIN_GOALS, TEACHING_STYLES, type SavedPreferences } from "@/lib/matching-options";

import { findTutorsAction, type MatchFormState } from "../actions";

type TimeRow = { weekday: number; startTime: string; endTime: string };

/** Every half hour from 7:00 AM to 10:00 PM. */
const TIMES = Array.from({ length: 31 }, (_, index) => {
  const minutes = 7 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

type Props = {
  learnerId: string;
  learnerName: string;
  knownSubjects: string[];
  saved: SavedPreferences;
};

export function SearchForm({ learnerId, learnerName, knownSubjects, saved }: Props) {
  const [state, formAction, isSearching] = useActionState<MatchFormState, FormData>(findTutorsAction, {});
  const [rows, setRows] = useState<TimeRow[]>(
    saved.availability?.length ? saved.availability : [{ weekday: 1, startTime: "15:00", endTime: "18:00" }],
  );

  function updateRow(index: number, change: Partial<TimeRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));
  }

  // Submit by hand so a server error keeps everything typed in.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const answers = new FormData(event.currentTarget);
    startTransition(() => formAction(answers));
  }

  const firstName = learnerName.split(" ")[0];

  return (
    <form onSubmit={handleSubmit} className={`${paper.card} ${paper.formCard} ${paper.fields}`}>
      <input type="hidden" name="learnerId" value={learnerId} />
      <input type="hidden" name="availability" value={JSON.stringify(rows)} />

      <div className={admin.inline}>
        <label className={paper.field}>
          <span className={paper.label}>Subject</span>
          <input className={paper.input} name="subject" list="known-subjects" defaultValue={knownSubjects[0] ?? ""} required />
          <datalist id="known-subjects">
            {knownSubjects.map((subject) => <option key={subject} value={subject} />)}
          </datalist>
        </label>
        <label className={paper.field}>
          <span className={paper.label}>Level</span>
          <select className={admin.select} name="level" defaultValue="high_school">
            {LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
          </select>
        </label>
      </div>

      <fieldset className={paper.fields}>
        <legend className={paper.label}>When can {firstName} meet each week? (Eastern time)</legend>
        {rows.map((row, index) => (
          <div key={index} className={matching.timeRow}>
            <select className={admin.select} aria-label="Day" value={row.weekday} onChange={(e) => updateRow(index, { weekday: Number(e.target.value) })}>
              {WEEK_ORDER.map((weekday) => <option key={weekday} value={weekday}>{WEEKDAY_NAMES[weekday]}s</option>)}
            </select>
            <select className={admin.select} aria-label="From" value={row.startTime} onChange={(e) => updateRow(index, { startTime: e.target.value })}>
              {TIMES.map((time) => <option key={time} value={time}>{formatClock(time)}</option>)}
            </select>
            <select className={admin.select} aria-label="Until" value={row.endTime} onChange={(e) => updateRow(index, { endTime: e.target.value })}>
              {TIMES.map((time) => <option key={time} value={time}>{formatClock(time)}</option>)}
            </select>
            <button
              type="button"
              className={matching.removeRow}
              aria-label="Remove this time"
              disabled={rows.length === 1}
              onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className={paper.link}
          onClick={() => setRows((current) => [...current, { weekday: 3, startTime: "16:00", endTime: "18:00" }])}
        >
          + Add another time
        </button>
      </fieldset>

      <fieldset className={paper.field}>
        <legend className={paper.label}>What kind of tutor helps {firstName} most?</legend>
        <div className={matching.pills}>
          {[...TEACHING_STYLES, { value: "any", label: "No preference" }].map((style) => (
            <label key={style.value} className={matching.pill}>
              <input type="radio" name="teachingStyle" value={style.value} defaultChecked={(saved.teachingStyle ?? "any") === style.value} />
              {style.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={paper.field}>
        <legend className={paper.label}>Main goal</legend>
        <div className={matching.pills}>
          {MAIN_GOALS.map((goal) => (
            <label key={goal.value} className={matching.pill}>
              <input type="radio" name="mainGoal" value={goal.value} defaultChecked={saved.mainGoal === goal.value} />
              {goal.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={paper.field}>
        <legend className={paper.label}>Tutor preference</legend>
        <div className={matching.pills}>
          {[
            { value: "any", label: "No preference" },
            { value: "female", label: "Female tutor" },
            { value: "male", label: "Male tutor" },
          ].map((option) => (
            <label key={option.value} className={matching.pill}>
              <input type="radio" name="tutorGender" value={option.value} defaultChecked={(saved.tutorGender ?? "any") === option.value} />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className={paper.field}>
        <span className={paper.label}>Anything else we should know?</span>
        <textarea className={paper.input} name="notes" defaultValue={saved.notes ?? ""} placeholder="e.g. Works best with lots of practice problems" />
        <span className={paper.hint}>Only TutorMe reads this until your match is approved; then your tutor sees it too.</span>
      </label>

      {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
      {state.message === "none" && (
        <p className={paper.note}>no one fits just yet — TutorMe will find {firstName} a tutor by hand and let you know.</p>
      )}

      <button type="submit" className={paper.primary} disabled={isSearching}>
        {isSearching ? "Finding tutors…" : "Find tutors"}
      </button>
    </form>
  );
}
