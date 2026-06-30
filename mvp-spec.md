# Post-Session Workflow Assistant — MVP Build Spec

## What this product is

An AI workflow assistant for tutors and coaches that turns a session recording into a polished follow-up package: a parent/client-ready summary email, a homework/action list with deadlines, progress notes with weak-topic tracking, and a next-session prep brief. It is not a meeting recorder or transcription tool — those are commodity inputs. The product's value is what happens after the recording: structured, editable, professional outputs that save the provider unpaid admin time, plus a compounding student/client history layer that makes every subsequent session smarter than the last.

The MVP scope is intentionally narrow: one tutor uploads one recording for one student and gets one output package back, with profiles and history layered on top. No calendar sync, no email sending, no payment tiers, no Zoom/Meet API integration yet. Those are explicitly post-MVP.

## Target user (MVP)

Independent tutors and academic/test-prep coaches working with recurring students. Single-tutor accounts only — no multi-user tutoring centers in this phase.

## Core user flow

1. Tutor logs in.
2. Tutor selects an existing student or creates a new student profile.
3. Tutor uploads a session recording (audio or video file).
4. System transcribes the recording with speaker separation (tutor vs. student).
5. System runs the transcript, plus that student's prior session history, through Claude to generate five outputs in one structured call.
6. Tutor reviews and edits the outputs on a single review screen.
7. Tutor saves the finalized session. It's added to that student's timeline and weak-topic history feeds forward into future sessions.

## Tech stack

- **Frontend/hosting:** Next.js 14+ (App Router), deployed on Vercel. TypeScript throughout.
- **Database + Auth + File Storage:** Supabase (Postgres, Supabase Auth, Supabase Storage).
- **Transcription:** Groq API (`whisper-large-v3`) for speed and free-tier availability. Use AssemblyAI as a fallback/alternative if speaker diarization quality from Groq proves insufficient — AssemblyAI has built-in diarization on its free tier.
- **AI analysis:** Anthropic API, Claude Sonnet model, single structured call per session returning JSON.
- **Styling:** Tailwind CSS. Keep components plain — no heavy UI library needed for MVP.
- **File handling:** Direct browser-to-Supabase-Storage upload via signed URLs (do not proxy large files through Vercel serverless functions — they have payload/duration limits).

## Data model (Supabase / Postgres)

```sql
-- Tutors (extends Supabase auth.users)
create table tutors (
  id uuid primary key references auth.users(id),
  name text not null,
  email text not null,
  created_at timestamptz default now()
);

-- Students belong to a tutor
create table students (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid references tutors(id) not null,
  name text not null,
  subject text,
  grade_level text,
  goals text,
  parent_email text,
  created_at timestamptz default now()
);

-- Sessions belong to a student
create table sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) not null,
  tutor_id uuid references tutors(id) not null,
  status text not null default 'uploaded',
    -- uploaded -> transcribing -> transcribed -> analyzing -> ready -> error
  recording_storage_path text,
  transcript text,
  transcript_speakers jsonb,
  ai_output jsonb,
    -- { summary, parent_email, homework: [{task, deadline}], progress_notes,
    --   weak_topics: [string], next_session_prep }
  edited_output jsonb,
    -- same shape as ai_output, holds tutor's edited version; null until tutor saves edits
  error_message text,
  session_date timestamptz default now(),
  created_at timestamptz default now()
);

-- Row-level security: tutors only see their own students/sessions
alter table students enable row level security;
alter table sessions enable row level security;

create policy "tutors manage own students" on students
  for all using (tutor_id = auth.uid());
create policy "tutors manage own sessions" on sessions
  for all using (tutor_id = auth.uid());
```

Notes for the build:
- `ai_output` is the raw Claude response. `edited_output` is what the tutor has modified. Always display `edited_output` if it exists, otherwise `ai_output`. This avoids ever overwriting the AI's original output, which is useful for debugging prompt quality later.
- Delete the file at `recording_storage_path` from Supabase Storage once `transcript` is successfully populated, to stay within the free storage tier. Keep only the text.
- `weak_topics` should be an array of short tag strings (e.g. `"fractions"`, `"essay thesis statements"`) — this is what gets aggregated on the student timeline view and fed forward into future session prompts.

## AI analysis call (the core of the product)

One call per session. Input: the full transcript (with speaker labels), the student's profile (name, subject, grade, goals), and a compact summary of their prior session history (last 2-3 sessions' weak topics, homework completion status, and prep notes — summarized, not raw transcripts, to control token usage).

System prompt should instruct Claude to act as an assistant to the tutor, not the student, and to return **only valid JSON**, no preamble, matching this exact shape:

```json
{
  "summary": "string - 2-4 sentence overview of what was covered",
  "parent_email": "string - full draft email, warm and professional tone, written as if from the tutor",
  "homework": [
    { "task": "string", "deadline": "string or null" }
  ],
  "progress_notes": "string - tutor-facing notes on how the student is doing",
  "weak_topics": ["string", "string"],
  "next_session_prep": "string - what the tutor should review or prepare before the next session"
}
```

Build in JSON validation on the response with a single retry if parsing fails (ask Claude to reformat as valid JSON). Log raw failures for prompt-debugging later.

## Screens (MVP UI)

Keep the UI plain and functional. Use Tailwind defaults, no custom design system needed yet — clarity over polish at this stage.

**1. Login / signup** — Supabase Auth email/password. Minimal.

**2. Dashboard** — list of students (name, subject, last session date). Button to add a new student. Clicking a student goes to their profile page.

**3. Student profile page** — student details at top (name, subject, grade, goals — editable). Below that, a chronological timeline of past sessions (date, one-line summary, link to view full output). A rollup section showing the most frequently tagged weak topics across all sessions. "Upload new session" button.

**4. Upload session** — file picker/drag-and-drop for the recording. On submit, creates the session record and kicks off the transcription job. Redirects to a processing/status screen that polls until the AI output is ready (simple "Processing your session..." state is fine — no need for a progress bar with granular steps in MVP).

**5. Review and edit outputs** — the most important screen. Five sections, each in its own card, each independently editable as a textarea (homework list can be a simple repeatable task + deadline input pair):
   - Session Summary
   - Parent/Client Email (with a "Copy to clipboard" button)
   - Homework / Action Items
   - Progress Notes
   - Next-Session Prep

A single "Save" button persists all edits to `edited_output`. No autosave needed for MVP.

## Build order for Claude Code

Build and verify in this order — do not move to the next step until the current one works end-to-end with real data:

1. Scaffold Next.js + Tailwind + Supabase client setup. Verify deploy to Vercel works with a blank page.
2. Supabase Auth: signup/login pages, protected routes, `tutors` table sync on signup.
3. `students` table + CRUD: dashboard list, create student form, student profile page (no sessions yet).
4. File upload to Supabase Storage with signed URLs, `sessions` row creation, status field.
5. Transcription pipeline: serverless function calls Groq/AssemblyAI, stores transcript + speaker labels, updates session status. Test with 3-5 real recordings before moving on.
6. Claude analysis call: build the prompt, call the Anthropic API, validate and store JSON output. Test against the same 3-5 recordings and manually grade output quality before building the UI around it.
7. Review/edit screen: render the five output sections, make them editable, wire up the save action.
8. Student timeline: list past sessions on the profile page, aggregate weak topics.
9. History feedback loop: pull prior session summaries into the AI call's context for returning students. Verify a second session for the same student visibly reflects the first.
10. Error states and polish: failed transcription, malformed AI JSON, empty states, basic loading indicators.

## Explicitly out of scope for MVP

Google Calendar reminders, Gmail/email sending integration, Zoom/Meet/Teams recording-link import, payment/subscription tiers, multi-tutor/team accounts, mobile app, real-time transcription during a live session.
