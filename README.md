# Cadence — Post-Session Workflow Assistant (UI Scaffold)

An AI workflow assistant for tutors and coaches that turns a session recording
into a polished follow-up package. This repository currently contains the
**UI scaffold only** — every screen and the full flow are clickable, but no
backend features (Supabase auth, Groq transcription, Anthropic analysis) are
wired up yet. See [`mvp-spec.md`](./mvp-spec.md) for the full product spec and
[`CLAUDE.md`](./CLAUDE.md) for the working constraints.

> "Cadence" is a working product name used in the UI — rename freely in
> [`components/brand.tsx`](./components/brand.tsx).

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** with a custom "warm editorial" design system
- Mock data only (see [`lib/mock-data.ts`](./lib/mock-data.ts)) — no live services

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build / type-check
```

## The scaffolded flow

| Screen | Route | Notes |
| --- | --- | --- |
| Landing | `/` | Marketing hero + how-it-works |
| Login / signup | `/login` | Toggle between modes; submit → dashboard |
| Dashboard | `/dashboard` | Student list + add-student tile |
| New student | `/students/new` | Create-profile form |
| Student profile | `/students/[id]` | Details, session timeline, weak-topic rollup |
| Upload session | `/students/[id]/upload` | Drag-and-drop dropzone |
| Processing | `/sessions/[id]/processing` | Animated pipeline (faked timing) |
| Review & edit | `/sessions/[id]/review` | The five editable output cards |

## What's intentionally NOT built yet

Authentication, file storage, transcription, the Claude analysis call, and any
persistence. These are the next steps per the build order in `mvp-spec.md`.

## Design system

The look is defined in [`tailwind.config.ts`](./tailwind.config.ts) (color
tokens, shadows, animations) and [`app/globals.css`](./app/globals.css)
(component classes like `.btn-accent`, `.card-sticker`, `.field`, plus the grain
and gradient-blob effects). Shared UI lives in [`components/`](./components).
