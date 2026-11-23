1. When adding a feature, do NOT delete old code, new features should be purely additive. Any code deletions or fixes must be said out loud before applying them
2. Keep the code human readable. Clean code is important, but prioritize code a human can read and analayze. 
3. Suggestions are welcome, but must be approved by me
4. Another AI will review your code after you finish, so make sure your code is clean and perfect.
5. Keep the UI away from looking blocky, generic, and overall painful to the eyes. Make it look unique, go crazy, and make sure the website really pops. The UI is the first thing the user sees, so the UI should be the most unique thing on the page. You can do this by implementing different effects, styles etc, just avoid blocky styles and corporate layout.

---

# Project context (updated Nov 19, 2026)

Everything below is the hand-off for a new chat. Read it, then [mvp-spec.md](mvp-spec.md), before planning or building anything.

## What we're building

**TutorMe** is a tutoring agency portal: parents book, pay and message; tutors teach and track progress; the admin (Ibrahim) matches families and runs payouts. **Clientee** is the tutor side of it.

- The full plan is [mvp-spec.md](mvp-spec.md). v0 = sign-up with parent–learner linking, tutor invites, rule-based matching with admin approval, availability and booking, Zoom links, messaging with a contact filter, Stripe Connect charges and weekly payouts. Clientee's AI features are v1.
- The user is reviewing the whole site now and will come back with feedback. **The site is not production-ready yet**, and nothing is online. Wait for their feedback before starting new features.

## Where things stand

All of v0 is built except the real Zoom and Stripe connections, which are deliberately postponed ("later") and stubbed so they're easy to connect.

| Slice | What it covers |
| --- | --- |
| Foundation | Next.js app, Drizzle schema, row-level security |
| Sign-up | Parent / learner / adult-learner sign-up, email codes, parent–learner linking, invites (links shown on screen), parental consent record |
| Admin console | Intake & matching, tutor invites and contracts, tutor profile approval |
| Booking | Weekly hours, one-off and weekly booking, move, cancel (24h rule), record outcome |
| Matching | Rule-based suggestions → family request → tutor accepts within 48h → admin approves; trial session first; admin hand-match override |
| Messaging | Threads learner↔tutor, family↔TutorMe, tutor↔TutorMe; contact filter holds messages for admin; 5-second polling |
| Desk redesign | Family and tutor screens use the admin's "desk" layout (stamp, notebook tabs, sticky notes, next-session ticket, to-do list) |
| Stand-ins | Zoom and Stripe plugged in but idle; admin **Money** tab; tutor **Earnings** tab |

- **Git:** `main` is at `05cdb98`, pushed to https://github.com/ibbydiggy250/Clientee. Each slice was built on its own `feat/*` branch and fast-forwarded into `main`; those branches are kept. Run `git status` / `git log` for the live state rather than trusting this file.
- **Untracked on purpose, never commit:** `scripts/dev-test-accounts.json` (dev test logins and their password).
- **The production database is empty.** Every migration so far has only run on the dev branch (see below).

### Screens by role

- **Family** (parent or learner): Home, Sessions (week calendar; booking at `/book/...`), Learners (each learner's page at `/learners/<id>`; finding a tutor at `/match/...`), Messages.
- **Tutor** (Clientee): Today, Schedule (week calendar), Learners (learner file at `/learners/<id>`), Earnings, Messages, Profile (full profile edits for admin approval, plus the weekly-hours calendar; `/availability` redirects there).
- **Admin** (`/admin`): Intake & matching, Tutors, Money, Messages.
- Public: `/`, `/sign-in`, `/sign-up` (+ `/sign-up/finish`), `/verify`, `/invite/<code>`.

## Decisions already made (don't re-ask)

- **Look: "Margin Notes."** Ruled cream paper, Fraunces (display), Caveat (handwriting), Inter Tight (body), ink `#1b2340`, pen red `#e0412b`, taped notes, hard-offset shadows, hand-drawn circles and ticks. Shared pieces live in `components/paper` and `components/desk`.
- **Sign-up:** invite links are shown on screen (no mailer yet); parental consent is recorded (timestamp + who) when a parent links to a minor; a minor may fill in a full profile before a parent links.
- **Booking:** 60-minute sessions at the enrollment's hourly rate; free to cancel or move 24+ hours ahead; later family cancellations and no-shows are charged in full and the tutor is still paid; bookings need at least 12 hours' notice; a tutor match is enough to book until Stripe adds a card-on-file rule.
- **Matching:** levels are Elementary, Middle school, High school, AP, SAT/ACT, College; intake asks weekly availability, teaching style, main goal, tutor gender preference and free-text notes (not scored); the trial is at normal price; admin hand-matching stays; tutor bio/video changes go live only after admin approval; family notes reach the tutor only after admin approves the match.
- **Messaging:** filtered messages (phone, email, social handles, links) are held until admin approves or rejects; a no-login learner's account holder takes their seat in the tutor thread; live updates poll every 5 seconds, built to switch to Neon Realtime later.
- **Zoom stand-in:** no fake links; sessions show "zoom link coming soon" until Zoom is connected.
- **Stripe stand-in:** charged sessions are recorded as `pending` payments with a 75/25 split; admin sees them on Money; tutors see only their own share on Earnings (its own tab, to keep Today short). Parents see nothing about money until real Stripe exists.
- **Framework:** Next.js (the spec's "confirm" question is settled by the build).

## Still open (ask before assuming)

From the spec's "Open questions": per-session payment vs prepaid packages; whether Stripe's card fee comes out before or after the split (for now TutorMe absorbs it, as in the spec's $60 → $45 / $15 example); lawyer review of consent and privacy (NY CDPA); whether progress reports go to parents directly or through admin; recording consent for minors; takeover pay in the tutor contract; Zoom seat per tutor vs shared pool. Also unanswered: should parents see a session's price when booking?

## Stack and code map

- **Next.js 16** (App Router, Server Actions, `proxy.ts` for sign-in redirects), **React 19**, **TypeScript 5**, **Tailwind 4** (mostly CSS Modules, including `composes`), **Drizzle ORM** + drizzle-kit migrations, **zod 4**.
- **Neon:** Postgres plus **Neon Auth** (Managed Better Auth via `@neon/auth`, email-code verification). [neon.ts](neon.ts) declares the Neon services; a sample function [hello.ts](hello.ts) is deployed.
- `app/` routes · `components/` shared UI (`paper`, `desk`, `booking`, `matching`, `messages`) · `db/schema.ts` + `db/migrations/0000–0013` · `lib/` server logic (`booking`, `matching`, `messaging`, `contact-filter`, `payments`, `zoom`, `family`, `tutor-desk`, `admin`, `invites`, `auth/`…) · `scripts/` checks and admin tools.
- **Access control:** the database enforces row-level security. Reads for a signed-in person go through `withUser()` in [lib/db.ts](lib/db.ts), which switches to the `app_user` role and sets `app.profile_id`. Trusted server writes run as the owner through `orm`, so those functions check permissions themselves. Helper functions live in the `app` schema (SECURITY DEFINER). `proxy.ts` only redirects; it is not the permission check.

## Databases and environments

- **Neon project:** TutorMe (`rough-king-01689586`), org `org-summer-poetry-45189888`. The link is in `.neon` (git-ignored).
- **`dev-foundation`** (`br-cool-river-bbpje3ea`): the test branch. No expiry. Migrations 0000–0013 applied, Neon Auth on, email verification on. All test accounts and data live here.
- **`production`:** untouched. No tables, email verification off.
- **`.env.development.local`** points at dev-foundation, so `npm run dev` uses the test branch. **`.env.local`** points at production.
- ⚠️ **`drizzle.config.ts` reads `.env.local`, so a bare `npm run db:migrate` targets PRODUCTION.** Always pass the dev URL explicitly (below). Production migrations need the user's explicit go-ahead.

## Running and checking

Commands are for Git Bash (the Bash tool). They fetch connection strings from the Neon CLI so nothing secret is printed.

- **Dev server:** use the preview tool with the `next-dev` entry in `.claude/launch.json` (port 3000). It runs against dev-foundation.
- **Migrate dev:** `DATABASE_URL_UNPOOLED="$(neon cs dev-foundation --project-id rough-king-01689586)" npx drizzle-kit migrate`
- **New migration:** edit `db/schema.ts`, then `npm run db:generate`; hand-written SQL for policies and grants goes in its own numbered migration.
- **Checks** (run with `TZ=UTC`; all passed at `05cdb98`):
  - `check-rls` uses the unpooled URL, and reads `DATABASE_URL_UNPOOLED` (otherwise it falls back to `.env.local`, which is production): `TZ=UTC DATABASE_URL_UNPOOLED="$(neon cs dev-foundation --project-id rough-king-01689586)" npx tsx scripts/check-rls.ts`
  - The rest use the pooled URL: `TZ=UTC DATABASE_URL="$(neon cs dev-foundation --project-id rough-king-01689586 --pooled)" npx tsx scripts/check-<name>.ts` for `admin`, `booking`, `matching`, `messaging`, `payments`.
- **Typecheck:** `npx tsc --noEmit`. `npm run build` fails while the dev server is running (it locks `.next`); stop the preview first.
- **Test logins** (parent, learners, tutor, admin, one shared password) are in `scripts/dev-test-accounts.json`. Dev-only; the user is fine with sharing them in chat. Don't copy them into tracked files.
- **Make someone admin:** `npx tsx scripts/make-admin.ts --branch <neon branch> --email <email>` (they must sign up first; the branch is required so production is never hit by accident).

## Zoom and Stripe stand-ins (how to connect later)

- **Zoom** ([lib/zoom.ts](lib/zoom.ts)): booking, moving and cancelling already call it. Add `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` from a Zoom "Server-to-Server OAuth" app and new bookings get real meetings; the note becomes a Join button. Each tutor's Zoom user goes in `tutors.zoom_user_id`. The API code is written but untested until real keys exist. Zoom failures never block a booking.
- **Stripe** ([lib/payments.ts](lib/payments.ts)): completed sessions, no-shows and late cancels record one `pending` payment each. To connect: add `STRIPE_SECRET_KEY`, fill in `collectPayment`, add a weekly job that turns each tutor's weekly total into a Stripe transfer plus a `payouts` row, add tutor onboarding (Stripe Express hosted form, `tutors.stripe_account_id`), and add the card-on-file rule to booking. Then build the parents' Payments area (saved card, receipts, history). The billing-model question above should be settled first.
- Check them with `scripts/check-payments.ts`.

## Going online (when the user says the site is ready)

Accounts made locally are real but live on the test branch; the live site starts empty. Steps, and who does what:

1. **Production database** (Claude, with go-ahead): run migrations 0000–0013 on `production` with its unpooled URL, then run `check-rls` against production.
2. **Production sign-in** (Claude, with go-ahead): turn on email verification for Neon Auth on production; add the live site address to Neon Auth's trusted domains.
3. **Email sender** (user sets up the account, Claude connects it): a sender such as Resend or Postmark, ideally with TutorMe's own domain verified via DNS, configured as Neon Auth's custom SMTP so sign-up codes don't land in spam. The same sender can later carry notification emails.
4. **Hosting on Vercel** (user creates the account and links GitHub, Claude walks through settings): set the production values for `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL` and a newly generated `NEON_AUTH_COOKIE_SECRET`. Pushes to `main` then redeploy. Invite links use the request's own address, so no site-URL setting is needed.
5. **First admin:** the user signs up on the live site, then `make-admin.ts --branch production --email <theirs>`.
6. **Smoke test on the live site:** sign up a parent, invite a tutor, match, book, message, record a session.
7. **Optional cleanup** (ask first): the leftover Supabase variables in `.env.local`; the unused Neon API key `3527601` (`neon api-keys revoke 3527601`); a custom domain.

**Cost:** Neon's free tier should do to start. Vercel's free Hobby plan is for non-commercial use, so TutorMe probably needs Pro (about $20/month); check Vercel's current terms first.

## Likely next work (only once the user picks)

- Fixes from the user's review of the site.
- Going online (above).
- Email notifications (new message, session booked/moved/cancelled, match request waiting), which need the email sender.
- Smaller spec gaps: admin session takeover (`sessions.taught_by` already supports it), tutor session notes (the base for v1 AI), real Zoom and Stripe.

## How the user likes to work

- Plain, short explanations. They work only through Claude Code.
- **Branch first** (`feat/<name>`), never commit to `main` directly. Commit, push and merge only when asked. Merges so far were fast-forwards (`git push origin <branch>:main`).
- Say every deletion or fix to existing code out loud before doing it (rule 1), including docs and config.
- Ask a few focused questions when a feature needs decisions, then build. Verify UI changes in the preview browser, at desktop and phone widths.
- Never print, log or paste secret values; refer to environment variables by name only.

## Environment variables (names only)

- **Neon** (in both env files; written by `neon deploy`): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`, `NEON_BRANCH_ID`, `NEON_FUNCTION_HOST_SUFFIX`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`.
- **App secret:** `NEON_AUTH_COOKIE_SECRET` signs session cookies (not written by `neon deploy`).
- **Not set yet:** `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `STRIPE_SECRET_KEY`.
- **Leftover in `.env.local`:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Unused; ask before removing.
- There is no Anthropic or Groq key; those placeholders were removed on purpose. Keep `.gitignore`: it keeps the env files and `.neon` out of git.

## Claude Code setup

- **Model:** Opus 5.5. The Fable advisor was scheduled to switch off on Nov 17, 2026 at 3:00 AM Eastern; don't use it after that.
- **Skills** in `~/.claude/skills` come from `mattpocock/skills`, `leonxlnx/taste-skill` and `emilkowalski/skills` (renamed to avoid clashes: `matt-prototype`, `emil-prototype`, `matt-code-review`). For UI work, `design-taste-frontend` and Emil Kowalski's animation skills fit rule 5. For Neon work, follow the `neon`, `neon-postgres`, `neon-auth`, `neon-functions` and `neon-realtime` skills.
- Local Node.js is 22.15.1; some Neon CLI features (`neon skills`) need 22.20.0+.

## History

- The codebase was wiped and restarted on Nov 12, 2026 (commit `c22a0b7`). The old Next.js + Supabase scaffold is on the local-only branch `archive/pre-wipe` (`af63fe5`), for reference only; don't restore Supabase code. Local branch `fresh-start` is an old copy of `main` and can be deleted.
