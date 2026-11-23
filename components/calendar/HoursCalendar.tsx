"use client";

/**
 * The tutor's weekly hours as a click-to-pick calendar (Profile tab).
 *
 * Each day is a column of half-hour boxes from 7 AM to 10 PM, Eastern time.
 *   - Mouse: click a box, or press and drag down a column, to paint hours on
 *     (or off, if the first box was already on).
 *   - Touch and keyboard: tap / Enter toggles one box.
 * Picked boxes turn into washi-tape strips. "Save hours" sends the whole week
 * at once (saveWeekOfHoursAction), and it goes live straight away.
 */
import { useActionState, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";

import paper from "@/components/paper/paper.module.css";
import { formatClock, formatClockRange, WEEKDAY_NAMES } from "@/lib/eastern-time";

import { saveWeekOfHoursAction, type SessionFormState } from "../../app/sessions/actions";
import styles from "./calendar.module.css";

export type WeeklyHours = { weekday: number; startTime: string; endTime: string };

/** Monday first, the way tutors plan a week. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_START_MINUTES = 7 * 60;
const DAY_END_MINUTES = 22 * 60;
const SLOT_MINUTES = 30;
const SLOT_COUNT = (DAY_END_MINUTES - DAY_START_MINUTES) / SLOT_MINUTES;
const SLOTS = Array.from({ length: SLOT_COUNT }, (_, index) => index);

/** "07:30" for slot 1, and so on. */
function clockOfSlot(slot: number): string {
  const minutes = DAY_START_MINUTES + slot * SLOT_MINUTES;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function slotOfClock(clockTime: string): number {
  const [hours, minutes] = clockTime.split(":").map(Number);
  return (hours * 60 + minutes - DAY_START_MINUTES) / SLOT_MINUTES;
}

const keyOf = (weekday: number, slot: number) => `${weekday}-${slot}`;

/** Saved windows → the set of picked boxes. */
function boxesFromHours(hours: WeeklyHours[]): Set<string> {
  const boxes = new Set<string>();
  for (const window of hours) {
    const first = Math.max(0, Math.floor(slotOfClock(window.startTime)));
    const last = Math.min(SLOT_COUNT, Math.ceil(slotOfClock(window.endTime)));
    for (let slot = first; slot < last; slot++) boxes.add(keyOf(window.weekday, slot));
  }
  return boxes;
}

/** Picked boxes → windows, joining boxes that touch into one block. */
function hoursFromBoxes(boxes: Set<string>): WeeklyHours[] {
  const hours: WeeklyHours[] = [];
  for (const weekday of WEEK_ORDER) {
    let blockStart: number | null = null;
    for (let slot = 0; slot <= SLOT_COUNT; slot++) {
      const isPicked = slot < SLOT_COUNT && boxes.has(keyOf(weekday, slot));
      if (isPicked && blockStart === null) blockStart = slot;
      if (!isPicked && blockStart !== null) {
        hours.push({ weekday, startTime: clockOfSlot(blockStart), endTime: clockOfSlot(slot) });
        blockStart = null;
      }
    }
  }
  return hours;
}

export function HoursCalendar({ hours }: { hours: WeeklyHours[] }) {
  const [boxes, setBoxes] = useState(() => boxesFromHours(hours));
  // What's saved right now, to tell whether there are unsaved changes.
  const [savedHours, setSavedHours] = useState(() => JSON.stringify(hoursFromBoxes(boxesFromHours(hours))));
  const paintMode = useRef<"on" | "off" | null>(null);
  const lastPainted = useRef<{ weekday: number; slot: number } | null>(null);
  const lastPointer = useRef<string>("mouse");

  const [state, formAction, isSaving] = useActionState<SessionFormState, FormData>(async (previous, form) => {
    const result = await saveWeekOfHoursAction(previous, form);
    if (!result.error) setSavedHours(String(form.get("windows")));
    return result;
  }, {});

  const windows = useMemo(() => hoursFromBoxes(boxes), [boxes]);
  const windowsJson = JSON.stringify(windows);
  const hasChanges = windowsJson !== savedHours;
  const totalHours = windows.reduce((sum, window) => sum + (slotOfClock(window.endTime) - slotOfClock(window.startTime)) / 2, 0);

  // Painting stops wherever the mouse is let go, even outside the calendar.
  useEffect(() => {
    const stopPainting = () => (paintMode.current = null);
    window.addEventListener("pointerup", stopPainting);
    return () => window.removeEventListener("pointerup", stopPainting);
  }, []);

  /** Turns boxes fromSlot…toSlot (either order) of one day on or off. */
  function paintRange(weekday: number, fromSlot: number, toSlot: number, isOn: boolean) {
    setBoxes((current) => {
      const next = new Set(current);
      for (let slot = Math.min(fromSlot, toSlot); slot <= Math.max(fromSlot, toSlot); slot++) {
        if (isOn) next.add(keyOf(weekday, slot));
        else next.delete(keyOf(weekday, slot));
      }
      return next;
    });
  }

  function startPainting(event: PointerEvent<HTMLButtonElement>, weekday: number, slot: number) {
    lastPointer.current = event.pointerType;
    if (event.pointerType === "touch") return; // touch toggles on tap instead, so scrolling still works
    event.preventDefault();
    paintMode.current = boxes.has(keyOf(weekday, slot)) ? "off" : "on";
    lastPainted.current = { weekday, slot };
    paintRange(weekday, slot, slot, paintMode.current === "on");
  }

  function continuePainting(weekday: number, slot: number) {
    if (!paintMode.current) return;
    // A fast mouse can skip boxes, so fill everything since the last box on the same day.
    const from = lastPainted.current?.weekday === weekday ? lastPainted.current.slot : slot;
    lastPainted.current = { weekday, slot };
    paintRange(weekday, from, slot, paintMode.current === "on");
  }

  function toggleOnTapOrKey(event: MouseEvent<HTMLButtonElement>, weekday: number, slot: number) {
    // detail 0 = a keyboard press; mouse clicks were already handled on pointer down.
    if (event.detail === 0 || lastPointer.current === "touch") paintRange(weekday, slot, slot, !boxes.has(keyOf(weekday, slot)));
  }

  return (
    <form action={formAction} className={styles.hoursForm}>
      <input type="hidden" name="windows" value={windowsJson} />

      <div className={styles.scroller}>
        <div className={styles.hoursGrid} role="grid" aria-label="Weekly hours, Eastern time">
          <div className={styles.hoursRow} role="row">
            <span aria-hidden />
            {WEEK_ORDER.map((weekday) => (
              <span key={weekday} className={styles.dayHead} role="columnheader">
                {WEEKDAY_NAMES[weekday].slice(0, 3).toLowerCase()}
              </span>
            ))}
          </div>

          {SLOTS.map((slot) => (
            <div key={slot} className={styles.hoursRow} role="row">
              <span className={styles.timeLabel} aria-hidden>
                {slot % 2 === 0 ? formatClock(clockOfSlot(slot)).replace(":00", "") : ""}
              </span>
              {WEEK_ORDER.map((weekday) => {
                const key = keyOf(weekday, slot);
                const isOn = boxes.has(key);
                const startsBlock = isOn && !boxes.has(keyOf(weekday, slot - 1));
                const endsBlock = isOn && !boxes.has(keyOf(weekday, slot + 1));
                const block = startsBlock ? windows.find((window) => window.weekday === weekday && window.startTime === clockOfSlot(slot)) : undefined;
                return (
                  <button
                    key={key}
                    type="button"
                    role="gridcell"
                    aria-pressed={isOn}
                    aria-label={`${WEEKDAY_NAMES[weekday]} ${formatClock(clockOfSlot(slot))}`}
                    className={`${styles.box} ${slot % 2 === 1 ? styles.boxHalf : ""} ${startsBlock ? styles.blockStart : ""} ${endsBlock ? styles.blockEnd : ""}`}
                    onPointerDown={(event) => startPainting(event, weekday, slot)}
                    onPointerEnter={() => continuePainting(weekday, slot)}
                    onClick={(event) => toggleOnTapOrKey(event, weekday, slot)}
                  >
                    {block && <span className={styles.blockLabel}>{formatClockRange(block.startTime, block.endTime)}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.hoursFooter}>
        <p className={paper.hint}>
          {totalHours === 0
            ? "No hours yet. Click or drag down a day to add some."
            : `${totalHours} hour${totalHours === 1 ? "" : "s"} a week. Families book 60-minute sessions inside these blocks.`}
        </p>
        {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
        {!hasChanges && state.done && !state.error && <p className={paper.note}>saved, families can book these now ✓</p>}
        {hasChanges && <p className={styles.unsaved}>unsaved changes</p>}
        <div className={paper.row}>
          <button type="submit" className={paper.primary} disabled={isSaving || !hasChanges}>
            {isSaving ? "Saving…" : "Save hours"}
          </button>
          {hasChanges && (
            <button type="button" className={paper.secondary} onClick={() => setBoxes(boxesFromHours(JSON.parse(savedHours)))}>
              Undo changes
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
