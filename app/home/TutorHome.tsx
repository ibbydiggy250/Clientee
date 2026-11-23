/**
 * Clientee → Today: the tutor's day at a glance.
 *   1. The next session, as a ticket.
 *   2. Sticky notes: sessions this week, requests waiting, sessions to record, unread.
 *   3. "Needs you": match requests to answer, sessions to record, setup steps.
 * The full schedule, hours, learners, messages and profile each have a tab.
 * (Before the redesign this page held everything; that content moved to
 * /schedule and /learners.)
 */
import Link from "next/link";

import desk from "@/components/desk/desk.module.css";
import { NextSessionTicket } from "@/components/desk/NextSessionTicket";
import { TodoList, type TodoItem } from "@/components/desk/TodoList";
import styles from "@/components/paper/paper.module.css";
import type { Profile } from "@/lib/auth/current-user";
import { formatSessionTime } from "@/lib/eastern-time";
import { getTutorDesk } from "@/lib/tutor-desk";

import { RespondButtons } from "../match/RespondButtons";
import { OutcomeButtons } from "../sessions/OutcomeButtons";

const WEEK = 7 * 24 * 60 * 60 * 1000;

function formatDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export async function TutorHome({ profile }: { profile: Profile }) {
  const now = new Date();
  const data = await getTutorDesk(profile, now);
  const firstName = profile.name.split(" ")[0];

  const toRecord = data.sessions.filter((session) => session.status === "scheduled" && session.endsAt <= now);
  const upcoming = data.sessions.filter((session) => session.status === "scheduled" && session.endsAt > now);
  const thisWeek = upcoming.filter((session) => session.startsAt.getTime() < now.getTime() + WEEK);
  const next = upcoming[0];

  const setupTodos: TodoItem[] = [
    ...(!data.hasHours ? [{ key: "hours", title: "Set your weekly hours", detail: "Families can only book inside them.", href: "/profile#hours", action: "Set hours" }] : []),
    ...(!data.tutor?.bio ? [{ key: "bio", title: "Write your public bio", detail: "It's what families read on your card.", href: "/profile", action: "Write it" }] : []),
  ];

  return (
    <div className={styles.sheet}>
      <header className={desk.pageHead}>
        <p className={styles.note}>clientee · hi {firstName.toLowerCase()} —</p>
        <h1 className={desk.pageTitle}>Today.</h1>
        <p className={styles.hint}>
          Contract {formatDate(data.tutor?.termStart ?? null)} → {formatDate(data.tutor?.termEnd ?? null)}
          {data.tutor?.subjects.length ? ` · ${data.tutor.subjects.join(", ")}` : ""}
        </p>
      </header>

      {data.contractEnded ? (
        <p className={styles.error}>Your contract has ended. Contact TutorMe if this is a mistake.</p>
      ) : (
        <>
          {next ? (
            <NextSessionTicket session={next} withWhom={next.learnerName} href="/schedule" linkLabel="Full schedule →" />
          ) : (
            <p className={styles.muted}>No sessions booked yet. They&apos;ll appear here as families book your hours.</p>
          )}

          <div className={desk.notes}>
            <Link className={desk.sticky} href="/schedule">
              <span className={desk.stickyNumber}>{thisWeek.length}</span>
              <span className={desk.stickyLabel}>sessions this week</span>
            </Link>
            <a className={desk.sticky} href="#needs-you">
              <span className={desk.stickyNumber}>{data.requests.length}</span>
              <span className={desk.stickyLabel}>families waiting on you</span>
            </a>
            <a className={desk.sticky} href="#needs-you">
              <span className={desk.stickyNumber}>{toRecord.length}</span>
              <span className={desk.stickyLabel}>sessions to record</span>
            </a>
            <Link className={desk.sticky} href="/messages">
              <span className={desk.stickyNumber}>{data.unread}</span>
              <span className={desk.stickyLabel}>unread messages</span>
            </Link>
          </div>

          <section className={styles.fields} aria-labelledby="needs-you">
            <h2 id="needs-you" className={styles.heading}>Needs you</h2>

            {/* New match requests: 48 hours to answer */}
            {data.requests.length > 0 && (
              <div className={desk.ledger} style={{ "--columns": "1.4fr 1fr auto" } as React.CSSProperties}>
                {data.requests.map((request) => (
                  <div key={request.id} className={desk.ledgerRow}>
                    <div className={styles.field}>
                      <span className={desk.name}>{request.learnerFirstName} would like to work with you</span>
                      <span className={desk.small}>
                        {[request.subject, request.level, request.grade, request.mainGoal, request.teachingStyle].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    <span className={desk.margin}>answer by {request.expiresAt ? formatSessionTime(request.expiresAt) : "soon"}</span>
                    <RespondButtons requestId={request.id} />
                  </div>
                ))}
              </div>
            )}

            {/* Finished sessions waiting to be recorded */}
            {toRecord.length > 0 && (
              <div className={desk.ledger} style={{ "--columns": "1.4fr 1fr auto" } as React.CSSProperties}>
                {toRecord.map((session) => (
                  <div key={session.id} className={desk.ledgerRow}>
                    <div className={styles.field}>
                      <span className={desk.name}>How did {session.subject} with {session.learnerName.split(" ")[0]} go?</span>
                      <span className={desk.small}>{formatSessionTime(session.startsAt)} ET</span>
                    </div>
                    <span className={desk.margin}>please record it</span>
                    <OutcomeButtons sessionId={session.id} />
                  </div>
                ))}
              </div>
            )}

            <TodoList
              items={setupTodos}
              allClearText={data.requests.length || toRecord.length ? "that's everything else" : "all caught up"}
            />
          </section>
        </>
      )}
    </div>
  );
}
