/**
 * Clientee → Earnings (mvp-spec.md, "Tutor workspace": earnings).
 * The tutor's own share of each charged session, never the split or
 * TutorMe's cut:
 *   1. A taped note while payouts aren't switched on (no Stripe yet).
 *   2. Sticky notes: earned this week, sessions this week, not paid yet.
 *   3. Week by week, with whether that week has been paid.
 *   4. Each session they earned from, including no-shows and late cancels
 *      (tutors are paid for those, per the cancellation policy).
 * Its own tab, so Today stays short.
 */
import { redirect } from "next/navigation";

import desk from "@/components/desk/desk.module.css";
import { PortalShell } from "@/components/desk/PortalShell";
import paper from "@/components/paper/paper.module.css";
import { requireProfile } from "@/lib/auth/current-user";
import { formatSessionTime } from "@/lib/eastern-time";
import { formatDollars, getTutorEarnings, type PaymentLine } from "@/lib/payments";

import styles from "./earnings.module.css";

export const dynamic = "force-dynamic";

/** "Week of Nov 16" */
function formatWeek(periodStart: string): string {
  const monday = new Date(`${periodStart}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `Week of ${monday}`;
}

/** Why this session paid, from the tutor's side. */
function earnedBecause(line: PaymentLine): string {
  if (line.sessionStatus === "no_show") return "no-show (still paid)";
  if (line.sessionStatus === "cancelled") return "late cancel (still paid)";
  return "taught";
}

export default async function EarningsPage() {
  const { user, profile } = await requireProfile();
  if (profile.role === "client") redirect("/home");
  if (profile.role === "admin") redirect("/admin/money");

  const earnings = await getTutorEarnings(profile.id, new Date());

  return (
    <PortalShell user={user} profile={profile}>
      <div className={paper.sheet}>
        <header className={desk.pageHead}>
          <p className={paper.note}>clientee · your share of every session</p>
          <h1 className={desk.pageTitle}>Earnings.</h1>
        </header>

        {earnings && !earnings.stripeConnected && (
          <aside className={desk.tapedNote} aria-label="Payouts aren't switched on yet">
            <strong>Payouts aren&apos;t switched on yet.</strong> Every session below is tracked, and it&apos;s paid out
            weekly once TutorMe finishes setting up direct deposit.
          </aside>
        )}

        {!earnings || earnings.lines.length === 0 ? (
          <p className={paper.muted}>
            Nothing yet. Each session you mark as done on Today or Schedule shows up here with your share.
          </p>
        ) : (
          <>
            <div className={desk.notes}>
              <div className={desk.sticky}>
                <span className={`${desk.stickyNumber} ${desk.stickyMoney}`}>{formatDollars(earnings.thisWeekCents)}</span>
                <span className={desk.stickyLabel}>earned this week</span>
              </div>
              <div className={desk.sticky}>
                <span className={desk.stickyNumber}>{earnings.thisWeekSessions}</span>
                <span className={desk.stickyLabel}>sessions this week</span>
              </div>
              <div className={desk.sticky}>
                <span className={`${desk.stickyNumber} ${desk.stickyMoney}`}>{formatDollars(earnings.notPaidYetCents)}</span>
                <span className={desk.stickyLabel}>not paid out yet</span>
              </div>
            </div>

            <section className={paper.fields} aria-labelledby="weeks-heading">
              <h2 id="weeks-heading" className={paper.heading}>Week by week</h2>
              <div className={desk.ledger} style={{ "--columns": "1.4fr 0.8fr 0.9fr 1fr" } as React.CSSProperties}>
                <div className={desk.ledgerHead}>
                  <span>Week</span>
                  <span>Sessions</span>
                  <span>Earned</span>
                  <span>Paid?</span>
                </div>
                {earnings.weeks.map((week) => (
                  <div key={week.periodStart} className={desk.ledgerRow}>
                    <span className={desk.name}>{formatWeek(week.periodStart)}</span>
                    <span className={desk.money}>{week.sessions}</span>
                    <span className={desk.money}>{formatDollars(week.earnedCents)}</span>
                    {week.paidOut ? (
                      <span className={styles.paid}>paid ✓</span>
                    ) : (
                      <span className={desk.margin}>{earnings.stripeConnected ? "on its way" : "tracked, not paid yet"}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className={paper.fields} aria-labelledby="sessions-heading">
              <h2 id="sessions-heading" className={paper.heading}>Sessions</h2>
              <div className={desk.ledger} style={{ "--columns": "1.8fr 1fr 0.7fr" } as React.CSSProperties}>
                <div className={desk.ledgerHead}>
                  <span>Session</span>
                  <span>Why it paid</span>
                  <span>You earn</span>
                </div>
                {earnings.lines.map((line) => (
                  <div key={line.id} className={desk.ledgerRow}>
                    <div className={paper.field}>
                      <span className={desk.name}>
                        {line.subject} · {line.learnerName}
                      </span>
                      <span className={desk.small}>{formatSessionTime(line.sessionStartsAt)} ET</span>
                    </div>
                    <span className={desk.small}>{earnedBecause(line)}</span>
                    <span className={desk.money}>{formatDollars(line.tutorCents)}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </PortalShell>
  );
}
