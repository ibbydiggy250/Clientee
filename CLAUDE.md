1. When adding a feature, do NOT delete old code, new features should be purely additive. Any code deletions or fixes must be said out loud before applying them
2. Keep the code human readable. Clean code is important, but prioritize code a human can read and analayze. 
3. Suggestions are welcome, but must be approved by me
4. Another AI will review your code after you finish, so make sure your code is clean and perfect.
5. Keep the UI away from looking blocky, generic, and overall painful to the eyes. Make it look unique, go crazy, and make sure the website really pops. The UI is the first thing the user sees, so the UI should be the most unique thing on the page. You can do this by implementing different effects, styles etc, just avoid blocky styles and corporate layout.

---

# Project context (set up on Nov 12, 2026)

## What we're building

Clientee is the tutor workspace inside **TutorMe**, a tutoring agency portal where parents book, pay and message, tutors teach and track progress, and the admin (Ibrahim) matches families and runs payouts.

- The full plan is in [mvp-spec.md](mvp-spec.md). Read it before planning or building any feature.
- v0 scope: sign-up with parent–learner linking, tutor invites, manual matching, availability and booking, Zoom links, messaging with a contact filter, Stripe Connect charges and weekly payouts. Clientee's AI features come in v1.
- The spec's "Open questions" section is still undecided. Ask before assuming an answer to any of them.

## Fresh start

The codebase was wiped on Nov 12, 2026 to start over.

- The old Next.js + Supabase scaffold and its unfinished Supabase/login work are saved on the local git branch `archive/pre-wipe` (commit `af63fe5`). That branch is not pushed. Restore a file with `git checkout archive/pre-wipe -- <path>`.
- The wipe and the new Neon setup are committed (commit `c22a0b7`) and merged into `main`. `main` is ahead of `origin/main` and not pushed yet. Check `git status` before assuming what's committed or pushed.

## Backend: Neon (not Supabase)

The project uses **Neon** instead of Supabase. The spec has been updated to match.

- Neon project: **TutorMe** (`rough-king-01689586`), branch `production`, org `org-summer-poetry-45189888`. The link is stored in `.neon` (git-ignored).
- [neon.ts](neon.ts) declares the services: Postgres, Neon Auth, and Functions. A sample function, [hello.ts](hello.ts), is deployed. Apply changes to `neon.ts` with `neon deploy`.
- [lib/db.ts](lib/db.ts) exports `db`, a shared `pg` connection pool using the pooled `DATABASE_URL`. Import it from server code only. Use `DATABASE_URL_UNPOOLED` for migrations.
- Neon Auth is enabled but not wired into any app code yet. There is no frontend framework yet; Next.js on Vercel is assumed but still to be confirmed (see the spec's open questions).
- Follow the installed Neon agent skills (`neon`, `neon-postgres`, `neon-auth`, `neon-functions`) for Neon work.

## Environment variables (`.env.local`, git-ignored)

**Never print, log, or paste the values of these into chat.** Refer to them by name only.

- Neon: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`, `NEON_BRANCH_ID`, `NEON_FUNCTION_HOST_SUFFIX`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`. These are written by `neon deploy`.
- Leftover from the old Supabase setup: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. They're probably no longer needed; ask before removing them.
- The empty `GROQ_API_KEY` and `ANTHROPIC_API_KEY` placeholders were removed on purpose. There is no Anthropic or Groq key.
- Keep `.gitignore`. It stops `.env.local` and `.neon` from being committed.

## Claude Code setup

- **Main model:** Opus 5.5, with **Fable 5.2 as the advisor** (set in `~/.claude/settings.json` as `"model": "opus"` and `"advisorModel": "fable"`).
- **Advisor billing rule:** Fable is free on the Pro plan only until **Nov 17, 2026**. If using the advisor (or Fable in any form) would ever cost tokens outside the Pro plan, such as usage credits or extra usage, **stop and tell the user before calling it at all.** If you can't tell whether it would, don't call it; ask first.
- A one-time scheduled task, **"Turn off Fable advisor"**, removes `advisorModel` from the user settings on **Nov 17, 2026 at 3:00 AM Eastern**. It only runs while the Claude app is open. After that date, chats that were already open still need `/advisor off`.
- **Installed skills** (in `~/.claude/skills`, available in every project) come from three repos: `mattpocock/skills`, `leonxlnx/taste-skill`, and `emilkowalski/skills`. Clashing names were renamed:
  - `matt-prototype` and `emil-prototype` (both repos had a `prototype`)
  - `matt-code-review` (so it doesn't replace the built-in `/code-review`)
- For UI work, consider the `design-taste-frontend` skill and Emil Kowalski's animation skills (`animate`, `choreograph`, `review-animations`, etc.). They fit rule 5 above.
- `neon init` also set up Neon's MCP server for GitHub Copilot CLI and Kiro, using an account-wide API key (id `3527601`). If those tools aren't used, the key can be revoked with `neon api-keys revoke 3527601`.
- The local Node.js is 22.15.1. Some Neon CLI features (`neon skills`) need 22.20.0 or newer.