"use client";

/** Adds one weekly window (e.g. every Tuesday 3–6 PM). Times are Eastern. */
import { useActionState } from "react";

import paper from "@/components/paper/paper.module.css";
import { formatClock, WEEKDAY_NAMES } from "@/lib/eastern-time";

import admin from "../admin/admin.module.css";
import { addHoursAction, type SessionFormState } from "../sessions/actions";

/** Every half hour from 7:00 AM to 10:00 PM. */
const TIMES = Array.from({ length: 31 }, (_, index) => {
  const minutes = 7 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

/** Monday first, the way tutors plan a week. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function AddHoursForm() {
  const [state, formAction, isSaving] = useActionState<SessionFormState, FormData>(addHoursAction, {});

  return (
    <form action={formAction} className={`${paper.card} ${paper.formCard} ${paper.fields}`}>
      <div className={admin.inline}>
        <label className={paper.field}>
          <span className={paper.label}>Day</span>
          <select className={admin.select} name="weekday" defaultValue="1">
            {WEEK_ORDER.map((weekday) => (
              <option key={weekday} value={weekday}>
                Every {WEEKDAY_NAMES[weekday]}
              </option>
            ))}
          </select>
        </label>
        <label className={paper.field}>
          <span className={paper.label}>From</span>
          <select className={admin.select} name="startTime" defaultValue="15:00">
            {TIMES.map((time) => (
              <option key={time} value={time}>{formatClock(time)}</option>
            ))}
          </select>
        </label>
        <label className={paper.field}>
          <span className={paper.label}>Until</span>
          <select className={admin.select} name="endTime" defaultValue="18:00">
            {TIMES.map((time) => (
              <option key={time} value={time}>{formatClock(time)}</option>
            ))}
          </select>
        </label>
      </div>
      {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
      <button type="submit" className={paper.primary} disabled={isSaving}>
        {isSaving ? "Adding…" : "Add these hours"}
      </button>
    </form>
  );
}
