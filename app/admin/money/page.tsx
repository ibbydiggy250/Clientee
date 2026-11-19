/**
 * Admin → Money (mvp-spec.md, "Admin console" and "Payments and payouts").
 *   1. A taped note while Stripe isn't connected: everything here is
 *      recorded, nothing has been charged or paid.
 *   2. Sticky notes for this week: charges, owed to tutors, TutorMe's share,
 *      and payments still waiting to be collected.
 *   3. Weekly payouts: what each tutor is owed, week by week.
 *   4. Recent charges, one line per charged session.
 * The numbers come from lib/payments.ts.
 */
import desk from "@/components/desk/desk.module.css";
import paper from "@/components/paper/paper.module.css";
import { formatSessionTime } from "@/lib/eastern-time";
import {
  countPendingPayments,
  formatDollars,
  getWeeklyPayouts,
  isStripeConnected,
  listRecentPayments,
  payoutWeekOf,
  type PaymentLine,
} from "@/lib/payments";

import styles from "../admin.module.css";
import { getAdminActor } from "../guard";
import money from "./money.module.css";

export const dynamic = "force-dynamic";

/** "Week of Nov 16" */
function formatWeek(periodStart: string): string {
  const monday = new Date(`${periodStart}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `Week of ${monday}`;
}

/** Why a session was charged, in a few words. */
function chargeReason(line: PaymentLine): string {
  if (line.sessionStatus === "no_show") return "no-show";
  if (line.sessionStatus === "cancelled") return "late cancel";
  return "completed";
}

const STATUS_WORDS: Record<PaymentLine["status"], string> = {
  pending: "pending",
  succeeded: "paid",
  failed: "failed",
  refunded: "refunded",
};

export default async function AdminMoneyPage() {
  const admin = await getAdminActor();
  if (!admin) return null; // the layout already shows "staff only"

  const now = new Date();
  const lines = await listRecentPayments(now);
  const [weeks, pendingCount] = await Promise.all([getWeeklyPayouts(lines), countPendingPayments()]);

  const thisWeek = payoutWeekOf(now);
  const thisWeeksLines = lines.filter((line) => payoutWeekOf(line.sessionStartsAt) === thisWeek && line.status !== "refunded" && line.status !== "failed");
  const sum = (pick: (line: PaymentLine) => number) => thisWeeksLines.reduce((total, line) => total + pick(line), 0);

  return (
    <div className={paper.sheet}>
      <p className={paper.note}>the books</p>
      <h1 className={`${paper.title} ${paper.titleSmall}`}>Money.</h1>

      {!isStripeConnected() && (
        <aside className={money.taped} aria-label="Stripe isn't connected">
          <strong>Stripe isn&apos;t connected yet.</strong> Charges below are recorded, not collected, and no tutor has
          been paid. Once Stripe is set up, these same records are what get charged and paid out.
        </aside>
      )}

      <div className={desk.notes}>
        <div className={desk.sticky}>
          <span className={`${desk.stickyNumber} ${money.stickyMoney}`}>{thisWeeksLines.length}</span>
          <span className={desk.stickyLabel}>sessions charged this week</span>
        </div>
        <div className={desk.sticky}>
          <span className={`${desk.stickyNumber} ${money.stickyMoney}`}>{formatDollars(sum((line) => line.tutorCents))}</span>
          <span className={desk.stickyLabel}>owed to tutors this week</span>
        </div>
        <div className={desk.sticky}>
          <span className={`${desk.stickyNumber} ${money.stickyMoney}`}>{formatDollars(sum((line) => line.platformFeeCents))}</span>
          <span className={desk.stickyLabel}>TutorMe&apos;s share this week</span>
        </div>
        <div className={desk.sticky}>
          <span className={`${desk.stickyNumber} ${money.stickyMoney}`}>{pendingCount}</span>
          <span className={desk.stickyLabel}>charges waiting to be collected</span>
        </div>
      </div>

      <section className={paper.fields} aria-labelledby="payouts-heading">
        <h2 id="payouts-heading" className={paper.heading}>Weekly payouts</h2>
        {weeks.length === 0 ? (
          <p className={paper.muted}>Nothing owed yet. Sessions show up here once a tutor marks them done.</p>
        ) : (
          weeks.map((week) => (
            <div key={week.periodStart} className={money.week}>
              <div className={money.weekHead}>
                <span className={money.weekTitle}>{formatWeek(week.periodStart)}</span>
                <span className={styles.money}>{formatDollars(week.totalCents)}</span>
              </div>
              <div className={styles.ledger} style={{ "--columns": "1.5fr 0.7fr 0.8fr 1fr" } as React.CSSProperties}>
                <div className={styles.ledgerHead}>
                  <span>Tutor</span>
                  <span>Sessions</span>
                  <span>Owed</span>
                  <span>Payout</span>
                </div>
                {week.tutors.map((tutor) => (
                  <div key={tutor.tutorId} className={styles.ledgerRow}>
                    <span className={styles.name}>{tutor.tutorName}</span>
                    <span className={styles.money}>{tutor.sessions}</span>
                    <span className={styles.money}>{formatDollars(tutor.owedCents)}</span>
                    {tutor.paidOut ? (
                      <span className={`${money.chip} ${money.chip_succeeded}`}>sent</span>
                    ) : (
                      <span className={styles.margin}>{isStripeConnected() ? "not sent yet" : "waits for Stripe"}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className={paper.fields} aria-labelledby="charges-heading">
        <h2 id="charges-heading" className={paper.heading}>Recent charges</h2>
        {lines.length === 0 ? (
          <p className={paper.muted}>No charges yet.</p>
        ) : (
          <div className={styles.ledger} style={{ "--columns": "1.6fr 1.1fr 0.9fr 1.1fr 0.7fr" } as React.CSSProperties}>
            <div className={styles.ledgerHead}>
              <span>Session</span>
              <span>Tutor</span>
              <span>Price</span>
              <span>Split</span>
              <span>Status</span>
            </div>
            {lines.map((line) => (
              <div key={line.id} className={styles.ledgerRow}>
                <div className={paper.field}>
                  <span className={styles.name}>
                    {line.subject} · {line.learnerName}
                  </span>
                  <span className={styles.small}>
                    {formatSessionTime(line.sessionStartsAt)} ET · {chargeReason(line)}
                  </span>
                </div>
                <span>{line.tutorName}</span>
                <span className={styles.money}>{formatDollars(line.amountCents)}</span>
                <span className={styles.small}>
                  {formatDollars(line.tutorCents)} tutor · {formatDollars(line.platformFeeCents)} TutorMe
                </span>
                <span className={`${money.chip} ${money[`chip_${line.status}`]}`}>{STATUS_WORDS[line.status]}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
