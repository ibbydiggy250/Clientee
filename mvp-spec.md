# TutorMe Platform Spec (incl. Clientee)

Nov 12, 2026 · Ibrahim

## Overview

TutorMe is a tutoring agency run through one web portal: parents book, pay and message there; tutors teach and track progress there (Clientee); Ibrahim matches families and runs payouts there.

- **Agency, not marketplace.** Families hire through TutorMe. Tutors are contract-based and set their own hours and term length.
- **Business terms.** Tutors keep 75% of each session. Pricing is about $60/hr standard and $80+/hr for AP and SAT.

The platform has four jobs:

1. Keep the family relationship and all communication inside TutorMe. No phone numbers or emails are exchanged.
2. Automate parent charges and tutor payouts.
3. Give tutors free tools (Clientee, paid Zoom) that make staying worth it.
4. Track student progress so parents see results, not just hours.

## Users and roles

Four roles, one login system. Each role sees only its own data.

| Role | Who | Can do |
| --- | --- | --- |
| Account holder | A parent, or a learner who is 18+ | Pay, manage learners, see all sessions and threads for their learners |
| Learner | The student being tutored; own login optional | Book, reschedule, join sessions, message their tutor |
| Tutor | Contract tutor, invite only | Set availability, run sessions, write notes, message assigned learners only |
| Admin | Ibrahim | Everything: match, reassign or take over sessions, refunds, payouts, read all threads |

An adult learner is their own account holder. One account holder can have several learners. One learner can have several tutors, one per subject.

## Accounts and access

Clients sign themselves up, while tutors get in only by invite. Access follows account status, and accounts are never deleted.

### Client sign-up

The sign-up screen asks "What best describes you?"

- **Learner**
  1. Asks "Are you 18 or older?"
  2. Yes → self-managed account: profile, payment, booking.
  3. No → enter a parent's email. The parent gets an invite to link and add payment. The learner can build a profile but can't book until a parent links.
- **Parent**
  1. Add one or more learner profiles.
  2. For each learner, either manage it yourself (no student login) or invite the learner to their own login. The parent keeps visibility either way.

Rules:

- Links happen only through an email invite or code, and the other side must accept. No one can attach themselves to a learner by name.
- Each learner has exactly one account holder.
- New accounts start unmatched. Booking unlocks once admin assigns a tutor and a payment method is on file. Sign-up replaces the Google Form intake.

### Tutor lifecycle

Tutors never see the sign-up screen. Admin sends an invite after the contract is signed.

| Status | Reached when | Access |
| --- | --- | --- |
| `invited` | Admin sends the invite | Set password, complete Stripe onboarding |
| `active` | Invite accepted | Clientee and assigned learners |
| `offboarding` | `term_end` passes (scheduled job) | Read and finish notes for ~7 days, no new bookings |
| `inactive` | Offboarding window ends | Signed out and blocked; account kept |

- **Extending a term:** admin edits `term_end`.
- **Returning tutor:** admin re-invites and the same account goes back to `active`. Old learners stay hidden; only new assignments show.
- **Data stays with TutorMe:** learner profiles and history pass to the next tutor. No bulk export.

### Access rules

These are enforced in the database with Postgres row-level security on Neon, not just in the UI.

- A tutor sees a learner's data only while the tutor is active (or offboarding, read-only) and the enrollment is active.
- An account holder sees everything for their learners. A learner sees only their own data.
- For minors, the account holder can read tutor–learner threads.
- Admin sees everything.

### Minors and consent

Under-18 learners need a linked parent for three reasons:

- Minors' contracts are voidable.
- COPPA requires parental consent for under-13s.
- The NY Child Data Protection Act restricts collecting data from users known to be under 18 without consent.

Asking for age at sign-up means TutorMe knows who is under 18, so the CDPA applies. The parent link is where consent is captured, including consent to recording. Have a lawyer review the consent flow and privacy policy before launch.

## Client portal

Account holders and learners can do everything without ever needing the tutor's contact info.

- **Intake.** Built into sign-up: learner, grade, subjects, goals, availability.
- **Dashboard.** Upcoming sessions, a one-click Zoom join, and recent session summaries.
- **Booking.** Pick from the assigned tutor's open slots. Supports recurring weekly sessions.
- **Reschedule and cancel**, within the cancellation policy.
- **Payments.** Saved card, automatic charges, receipts and history.
- **Messages.** Threads with the tutor and with TutorMe.
- **Progress (v1).** Reports built from Clientee session notes.

## Tutor workspace (Clientee)

Clientee is the tutor side of the portal. It's free for TutorMe tutors; selling it standalone (~$35/mo) is deferred.

- **Tutor home.** Schedule, availability editor, contract term dates, earnings.
- **Student profiles.** Baseline, goals, strengths and gaps, full session history. TutorMe owns them, so they carry over when a student changes tutors.
- **Session log.** After each session the tutor adds notes, or the recording is pulled in (v1).
- **AI next-session agenda.** Generated from the notes and profile, and checked against the tutor's own teaching framework.
- **Progress reports (v1).** A periodic summary for parents, built from the logs.

**AI pipeline (v1):** recording → transcription (Groq Whisper or AssemblyAI) → Claude API → agenda and profile update. Raw recordings are deleted after transcription to stay within free-tier storage. Expected AI cost is about $0.05–0.10 per session.

## Admin console

The admin console is where Ibrahim runs the agency; in v0, matching is manual.

- **Intake queue.** New family requests, each matched to a tutor by hand.
- **Tutor roster.** Subjects, availability, contract status, term end dates. Alerts 2–4 weeks before a term ends, so the handoff to the next tutor starts early.
- **Session takeover.** Reassign any session to Ibrahim or another tutor. Pay follows whoever actually teaches.
- **Money.** Charges, refunds, payout schedule, per-tutor earnings.
- **Quality.** Read session notes and all message threads, review flagged messages, parent ratings (v1).
- **Zoom seats.** Which tutor holds which license.

## Scheduling and sessions

Tutors publish availability; parents book into it; every booking gets a Zoom meeting on TutorMe's account.

- **Availability.** Weekly hours plus contract start and end dates. No bookings past the term end.
- **Booking.** One-off or recurring weekly. Default time zone is Eastern.
- **Zoom.** The platform creates each meeting through the Zoom API under the tutor's TutorMe license. Pro costs $14.16/host/month billed annually, or $16.99 monthly. Every tutor who teaches at the same time as someone else needs their own seat.
- **Session states.** Scheduled → completed, cancelled, or no-show. A completed session triggers the charge and goes into that week's payout.
- **Takeover.** Admin swaps the teacher on a session. The new teacher gets the Zoom link and the payout.

## Messaging and anti-bypass

All contact runs through TutorMe accounts. The platform makes going direct hard; the contract is the backstop.

- **Threads.** Learner ↔ tutor, account holder ↔ TutorMe, tutor ↔ TutorMe. For minors, the account holder can read learner threads. Admin can read every thread.
- **No contact info.** Tutors never see a client's phone number or email. Notification emails come from TutorMe, and replies go back into the portal.
- **Contact filter.** Messages containing phone numbers, emails, or social handles are held or flagged for admin review.
- **Money only in the portal.** No outside payment methods.
- **Known gap.** Zoom chat and in-session talk can't be monitored. The non-solicit and buyout clauses in the tutor contract cover this.

## Payments and payouts

Parents pay TutorMe. Stripe Connect (Express) splits each payment automatically and pays tutors weekly.

1. Each tutor onboards as a Stripe Express connected account through Stripe's own hosted form, which covers ID and bank details.
2. The parent's card is saved at intake and charged when a session is marked completed.
3. The charge is split: 75% transfers to the teaching tutor's account; TutorMe keeps 25% as its platform fee.
4. Tutor payouts are batched weekly, which keeps per-payout fees down.
5. Refunds and disputes go through the admin console.

| Fee | Amount |
| --- | --- |
| Card processing | 2.9% + 30¢ per charge |
| Express account | $2 per tutor, only in months they get a payout |
| Payout | 0.25% + 25¢ each |
| 1099 e-filing | $1.49–2.99 per form |

Fees from NerdWallet and DropDesk. On a $60 session: the tutor gets $45 and TutorMe gets $15. Stripe's card fee is about $2.04, leaving TutorMe about $12.96 if it absorbs the fee.

## Data model

Fourteen core tables in Lakebase Postgres on Neon. Row-level security limits tutors to their assigned learners and account holders to their own learners.

| Table | Key fields |
| --- | --- |
| `profiles` | id, role (client, tutor, admin), name, email (linked to Neon Auth) |
| `accounts` | id, owner_id, stripe_customer_id |
| `learners` | id, account_id, profile_id (empty if no own login), name, grade, is_minor, goals, baseline |
| `invites` | id, kind (tutor, parent, learner), email, code, account_id, learner_id, status, expires_at |
| `tutors` | id, profile_id, status (invited, active, offboarding, inactive), subjects, stripe_account_id, zoom_user_id, term_start, term_end, split_pct (default 75) |
| `availability` | tutor_id, weekday, start_time, end_time |
| `enrollments` | id, learner_id, tutor_id, subject, tier, rate, status |
| `sessions` | id, enrollment_id, taught_by, starts_at, ends_at, status, zoom_meeting_id, price |
| `session_notes` | session_id, author_id, notes, transcript_ref, agenda_json |
| `progress_entries` | learner_id, metric, value, recorded_at |
| `threads` | id, learner_id, participant_ids |
| `messages` | id, thread_id, sender_id, body, flagged |
| `payments` | id, session_id, stripe_payment_intent_id, amount, fee, status |
| `payouts` | id, tutor_id, period, amount, stripe_transfer_id |

`sessions.taught_by` is set separately from the enrollment's tutor so takeovers pay the right person. `split_pct` per tutor leaves room for tenure raises later.

## Tech stack and architecture

One app and one database: Next.js (assumed) on Vercel with Neon (Lakebase Postgres and Neon Auth), calling Stripe, Zoom and AI services.

Architecture: 3 views, 1 app, 4 services. Each view is a role inside the same app. Stripe and Zoom also call back into it through webhooks, such as payment succeeded or recording ready.

## Scope

v0 replaces only the manual work done for real families today; Clientee's AI arrives in v1.

| Phase | Includes |
| --- | --- |
| v0 | Sign-up with parent–learner linking, tutor invites and term-based access, manual matching, tutor availability and booking, automatic Zoom links, messaging with contact filter, Stripe Connect charges and weekly payouts |
| v1 | Clientee notes and student profiles, AI agendas, recording ingest and transcription, parent progress reports, cancellation policy rules, term-end handoff alerts, parent ratings |
| Later | Tenure-based split raises, standalone Clientee at ~$35/mo, automated matching, outcomes analytics, mobile app |

## Open questions

These need a decision before or during v0.

- Do parents pay per session after it happens, or buy prepaid packages?
- Cancellation and no-show policy: what notice is required, and who absorbs the loss?
- Do Stripe fees come out before or after the 75/25 split?
- Lawyer review of the consent flow and privacy policy against the NY CDPA.
- Do progress reports go straight to parents, or through admin review first?
- Recording consent: how parents of minor students opt in to session recording before v1 ingest.
- Takeover pay: put "whoever teaches gets paid" into the tutor contract.
- Zoom: one seat per tutor, or a shared pool assigned by schedule?
- Frontend framework: Next.js is assumed in Tech stack. Confirm.
