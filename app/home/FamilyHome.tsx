/**
 * Family desk → Home: the week at a glance.
 *   1. The next session, as a ticket.
 *   2. Sticky notes: upcoming sessions, unread messages, learners matched, to-dos.
 *   3. "Needs you": a short list, one action each.
 * Details live on the other tabs (Sessions, Learners, Messages).
 */
import Link from "next/link";

import desk from "@/components/desk/desk.module.css";
import { NextSessionTicket } from "@/components/desk/NextSessionTicket";
import { TodoList, type TodoItem } from "@/components/desk/TodoList";
import styles from "@/components/paper/paper.module.css";
import type { Profile, SignedInUser } from "@/lib/auth/current-user";
import { listVisibleSessions } from "@/lib/booking";
import type { FamilyDesk } from "@/lib/family";
import { countUnread } from "@/lib/messaging";
import { publicTutorName } from "@/lib/public-name";

/** Everything the family should do next, in order of importance. */
function familyTodos(data: FamilyDesk, user: SignedInUser, upcomingEnrollmentIds: Set<string>, unread: number): TodoItem[] {
  const todos: TodoItem[] = [];
  const firstName = (name: string) => name.split(" ")[0];

  for (const learner of data.myLearners) {
    const matches = data.activeMatches.filter((match) => match.learnerId === learner.id);
    const invite = data.sentInvites.find((candidate) => candidate.learnerId === learner.id);

    if (learner.profileId === user.id && invite?.kind === "parent") {
      todos.push({ key: `parent-${learner.id}`, title: "Send your parent the link", detail: "They need to link up before you can book.", href: "/learners", action: "Get the link" });
    }
    if (learner.accountId && matches.length === 0) {
      todos.push({ key: `find-${learner.id}`, title: `Find ${firstName(learner.name)} a tutor`, detail: "Or check on a request you've already made.", href: `/match/${learner.id}`, action: "Find a tutor" });
    }
    for (const match of matches) {
      if (match.inTrial) {
        todos.push({ key: `trial-${match.enrollmentId}`, title: `${firstName(learner.name)}'s trial with ${publicTutorName(match.tutorName)}`, detail: "Book it, then tell us how it went.", href: `/match/${learner.id}`, action: "Open" });
      } else if (!upcomingEnrollmentIds.has(match.enrollmentId)) {
        todos.push({ key: `book-${match.enrollmentId}`, title: `Book ${match.subject} for ${firstName(learner.name)}`, detail: `Nothing booked with ${publicTutorName(match.tutorName)} yet.`, href: `/book/${match.enrollmentId}`, action: "Book" });
      }
    }
    if (invite?.kind === "learner") {
      todos.push({ key: `login-${learner.id}`, title: `Send ${firstName(learner.name)} their login link`, href: "/learners", action: "Get the link" });
    }
  }

  if (unread > 0) {
    todos.push({ key: "unread", title: `${unread} unread message${unread === 1 ? "" : "s"}`, href: "/messages", action: "Read" });
  }
  return todos;
}

export async function FamilyHome({ user, profile, desk: data }: { user: SignedInUser; profile: Profile; desk: FamilyDesk }) {
  const now = new Date();
  const sessions = await listVisibleSessions(user, now);
  const upcoming = sessions.filter((session) => session.status === "scheduled" && session.endsAt > now);
  const unread = await countUnread(user);
  const todos = familyTodos(data, user, new Set(upcoming.map((session) => session.enrollmentId)), unread);
  const matchedCount = data.myLearners.filter((learner) => data.activeMatches.some((match) => match.learnerId === learner.id)).length;
  const next = upcoming[0];

  return (
    <div className={styles.sheet}>
      <header className={desk.pageHead}>
        <p className={styles.note}>hi {profile.name.split(" ")[0].toLowerCase()} —</p>
        <h1 className={desk.pageTitle}>Your week, at a glance.</h1>
      </header>

      {next ? (
        <NextSessionTicket session={next} withWhom={`${next.learnerName.split(" ")[0]} with ${next.tutorName}`} href="/sessions" linkLabel="All sessions →" />
      ) : (
        <p className={styles.muted}>Nothing booked yet. Your next session will show up here.</p>
      )}

      <div className={desk.notes}>
        <Link className={desk.sticky} href="/sessions">
          <span className={desk.stickyNumber}>{upcoming.length}</span>
          <span className={desk.stickyLabel}>sessions coming up</span>
        </Link>
        <Link className={desk.sticky} href="/messages">
          <span className={desk.stickyNumber}>{unread}</span>
          <span className={desk.stickyLabel}>unread messages</span>
        </Link>
        <Link className={desk.sticky} href="/learners">
          <span className={desk.stickyNumber}>
            {matchedCount}/{data.myLearners.length}
          </span>
          <span className={desk.stickyLabel}>learners matched</span>
        </Link>
        <a className={desk.sticky} href="#needs-you">
          <span className={desk.stickyNumber}>{todos.length}</span>
          <span className={desk.stickyLabel}>things to do</span>
        </a>
      </div>

      <section className={styles.fields} aria-labelledby="needs-you">
        <h2 id="needs-you" className={styles.heading}>Needs you</h2>
        <TodoList items={todos} allClearText="all caught up" />
      </section>
    </div>
  );
}
