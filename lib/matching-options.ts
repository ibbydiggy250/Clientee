/**
 * The fixed lists families and tutors pick from when matching.
 * Kept in their own file with no server code, so browser components
 * (the search form, admin checkboxes) can import them safely.
 */
export const LEVELS = [
  { value: "elementary", label: "Elementary" },
  { value: "middle_school", label: "Middle school" },
  { value: "high_school", label: "High school" },
  { value: "ap", label: "AP" },
  { value: "sat_act", label: "SAT / ACT" },
  { value: "college", label: "College" },
] as const;
export type Level = (typeof LEVELS)[number]["value"];

export const TEACHING_STYLES = [
  { value: "patient", label: "Patient, step by step" },
  { value: "structured", label: "Structured and fast-paced" },
  { value: "challenging", label: "Challenge me" },
] as const;

export const MAIN_GOALS = [
  { value: "homework", label: "Homework help" },
  { value: "catch_up", label: "Catching up" },
  { value: "get_ahead", label: "Getting ahead" },
  { value: "test_prep", label: "Test prep" },
] as const;

export function levelLabel(level: string): string {
  return LEVELS.find((option) => option.value === level)?.label ?? level;
}

/** What a family saved when finding a tutor (see preferencesSchema in lib/matching.ts). */
export type SavedPreferences = {
  availability?: { weekday: number; startTime: string; endTime: string }[];
  teachingStyle?: "patient" | "structured" | "challenging" | "any";
  mainGoal?: "homework" | "catch_up" | "get_ahead" | "test_prep";
  tutorGender?: "female" | "male" | "any";
  notes?: string;
};
