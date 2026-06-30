// ---------------------------------------------------------------------------
// Mock data for the UI scaffold.
//
// This file fakes the shapes described in mvp-spec.md so every screen renders
// with realistic content. NONE of this is wired to Supabase / Groq / Anthropic
// yet — swapping these helpers for real data fetching is a later step.
// ---------------------------------------------------------------------------

export type SessionStatus =
  | "uploaded"
  | "transcribing"
  | "transcribed"
  | "analyzing"
  | "ready"
  | "error";

export type HomeworkItem = {
  task: string;
  deadline: string | null;
};

// Mirrors the `ai_output` / `edited_output` JSON shape from the spec.
export type AiOutput = {
  summary: string;
  parent_email: string;
  homework: HomeworkItem[];
  progress_notes: string;
  weak_topics: string[];
  next_session_prep: string;
};

export type Session = {
  id: string;
  studentId: string;
  status: SessionStatus;
  sessionDate: string; // ISO
  oneLineSummary: string;
  output: AiOutput | null;
};

export type Student = {
  id: string;
  name: string;
  subject: string;
  gradeLevel: string;
  goals: string;
  parentEmail: string;
  avatarTone: "violet" | "coral" | "amber" | "sage";
};

// --- Students --------------------------------------------------------------

export const students: Student[] = [
  {
    id: "maya-r",
    name: "Maya Rodriguez",
    subject: "SAT Math",
    gradeLevel: "11th grade",
    goals: "Reach a 1450+ composite; shore up algebra fundamentals before fall.",
    parentEmail: "rodriguez.family@example.com",
    avatarTone: "violet",
  },
  {
    id: "theo-k",
    name: "Theo Kim",
    subject: "AP Chemistry",
    gradeLevel: "12th grade",
    goals: "Build confidence with stoichiometry and earn a 5 on the May exam.",
    parentEmail: "kim.h@example.com",
    avatarTone: "coral",
  },
  {
    id: "ada-n",
    name: "Ada Nwosu",
    subject: "Essay Writing",
    gradeLevel: "9th grade",
    goals: "Develop clear thesis statements and structured argument paragraphs.",
    parentEmail: "nwosu.parent@example.com",
    avatarTone: "amber",
  },
  {
    id: "liam-p",
    name: "Liam Patel",
    subject: "Algebra II",
    gradeLevel: "10th grade",
    goals: "Catch up to grade level on quadratics and rational expressions.",
    parentEmail: "patel.family@example.com",
    avatarTone: "sage",
  },
];

// --- A sample fully-analyzed output (used on the review screen) -------------

export const sampleOutput: AiOutput = {
  summary:
    "We focused on quadratic equations, working through factoring and the quadratic formula. Maya showed strong recall on factoring simple trinomials but hesitated when the leading coefficient was greater than one. We closed by previewing how completing the square connects the two methods.",
  parent_email:
    "Hi Ms. Rodriguez,\n\nMaya and I had a productive session today working through quadratic equations. She's getting much more comfortable factoring, and we spent good time on the quadratic formula for trickier problems. Her persistence really stood out today.\n\nFor this week, I've asked her to complete a short practice set so the formula becomes second nature before our next session. I'll keep an eye on problems with larger leading coefficients, which is our current growth area.\n\nWarmly,\nYour tutor",
  homework: [
    { task: "Practice set: 10 quadratic-formula problems (odds only)", deadline: "Before next session" },
    { task: "Re-do the 3 factoring problems we got stuck on", deadline: "Thursday" },
    { task: "Watch the 'completing the square' intro video", deadline: null },
  ],
  progress_notes:
    "Maya is trending upward on algebra fundamentals. Factoring of simple trinomials is now reliable. The clear growth edge is factoring with a leading coefficient > 1 and recognizing when to switch strategies. Recommend one more session on this before moving to graphing parabolas.",
  weak_topics: ["quadratics", "factoring (a>1)", "completing the square"],
  next_session_prep:
    "Open with a 5-minute warm-up of two mixed quadratic problems to check homework retention. Then introduce graphing parabolas, connecting vertex form back to completing the square. Have grid paper ready.",
};

// --- Sessions (timeline for a student) -------------------------------------

export const sessionsByStudent: Record<string, Session[]> = {
  "maya-r": [
    {
      id: "sess-301",
      studentId: "maya-r",
      status: "ready",
      sessionDate: "2026-06-22T16:00:00Z",
      oneLineSummary: "Quadratics: factoring and the quadratic formula.",
      output: sampleOutput,
    },
    {
      id: "sess-298",
      studentId: "maya-r",
      status: "ready",
      sessionDate: "2026-06-15T16:00:00Z",
      oneLineSummary: "Linear systems and word-problem translation.",
      output: { ...sampleOutput, weak_topics: ["systems of equations", "word problems"] },
    },
    {
      id: "sess-290",
      studentId: "maya-r",
      status: "ready",
      sessionDate: "2026-06-08T16:00:00Z",
      oneLineSummary: "Exponent rules and simplifying expressions.",
      output: { ...sampleOutput, weak_topics: ["exponent rules", "fractions"] },
    },
  ],
  "theo-k": [
    {
      id: "sess-205",
      studentId: "theo-k",
      status: "ready",
      sessionDate: "2026-06-20T22:00:00Z",
      oneLineSummary: "Stoichiometry: limiting reagents and percent yield.",
      output: { ...sampleOutput, weak_topics: ["limiting reagents", "mole ratios"] },
    },
  ],
  "ada-n": [],
  "liam-p": [
    {
      id: "sess-110",
      studentId: "liam-p",
      status: "error",
      sessionDate: "2026-06-19T21:00:00Z",
      oneLineSummary: "Transcription failed — audio was too quiet to process.",
      output: null,
    },
  ],
};

// --- Lookup helpers (sync, mock) -------------------------------------------

export function getStudent(id: string): Student | undefined {
  return students.find((s) => s.id === id);
}

export function getSessions(studentId: string): Session[] {
  return sessionsByStudent[studentId] ?? [];
}

export function getSession(sessionId: string): Session | undefined {
  for (const list of Object.values(sessionsByStudent)) {
    const found = list.find((s) => s.id === sessionId);
    if (found) return found;
  }
  return undefined;
}

// Most-frequently-tagged weak topics across all of a student's sessions.
export function aggregateWeakTopics(
  studentId: string,
): { topic: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const session of getSessions(studentId)) {
    for (const topic of session.output?.weak_topics ?? []) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }
  return Array.from(counts, ([topic, count]) => ({ topic, count })).sort(
    (a, b) => b.count - a.count,
  );
}

// Last session date for a student, formatted, or null.
export function lastSessionDate(studentId: string): string | null {
  const sessions = getSessions(studentId);
  if (sessions.length === 0) return null;
  return sessions[0].sessionDate;
}
