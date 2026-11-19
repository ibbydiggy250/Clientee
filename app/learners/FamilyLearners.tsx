/**
 * Family desk → Learners: each learner's card with their status and one main
 * action, invites to send, and adding a learner. (Moved from the old home page.)
 */
import Link from "next/link";

import desk from "@/components/desk/desk.module.css";
import styles from "@/components/paper/paper.module.css";
import type { SignedInUser } from "@/lib/auth/current-user";
import type { FamilyDesk } from "@/lib/family";
import { invitePath } from "@/lib/invites";
import { publicTutorName } from "@/lib/public-name";
import { siteOrigin } from "@/lib/site-origin";

import { AddLearnerForm } from "../home/AddLearnerForm";
import { CopyLink } from "../home/CopyLink";
import { InviteLearnerForm } from "../home/InviteLearnerForm";

export async function FamilyLearners({ user, desk: data }: { user: SignedInUser; desk: FamilyDesk }) {
  const { myLearners, matchedLearnerIds, activeMatches, ownsAccount, sentInvites } = data;
  const origin = await siteOrigin();
  const pendingInviteFor = (learnerId: string) => sentInvites.find((invite) => invite.learnerId === learnerId);

  return (
    <div className={styles.sheet}>
      <header className={desk.pageHead}>
        <p className={styles.note}>who&apos;s learning</p>
        <h1 className={desk.pageTitle}>{myLearners.length === 1 ? "Learner." : "Learners."}</h1>
      </header>

      {myLearners.length === 0 && <p className={styles.muted}>No learners yet. Add your first one below.</p>}

      <div className={styles.cardGrid}>
        {myLearners.map((learner) => {
          const isMe = learner.profileId === user.id;
          const invite = pendingInviteFor(learner.id);
          const matches = activeMatches.filter((match) => match.learnerId === learner.id);
          return (
            <article key={learner.id} className={`${styles.card} ${styles.formCard}`}>
              {!learner.accountId ? (
                <span className={`${styles.stamp} ${styles.stampWaiting}`}>Waiting for a parent</span>
              ) : matchedLearnerIds.has(learner.id) ? (
                <span className={`${styles.stamp} ${styles.stampDone}`}>Matched</span>
              ) : (
                <span className={`${styles.stamp} ${styles.stampWaiting}`}>Awaiting tutor match</span>
              )}
              <h2 className={styles.choiceTitle}>
                {learner.name}
                {isMe && " (you)"}
              </h2>
              <p className={styles.muted}>
                {[learner.grade, learner.subjects.join(", ")].filter(Boolean).join(" · ") || "No details yet"}
              </p>
              {learner.goals && <p>{learner.goals}</p>}

              {/* Their tutors: one line each, booking is the main action */}
              {matches.map((match) => (
                <div key={match.enrollmentId} className={desk.lineItem}>
                  <span>
                    {match.subject} with {publicTutorName(match.tutorName)}
                    {match.inTrial && " · trial"}
                  </span>
                  <Link
                    className={`${styles.primary} ${styles.compact}`}
                    href={match.inTrial ? `/match/${learner.id}` : `/book/${match.enrollmentId}`}
                  >
                    {match.inTrial ? "Trial" : "Book"}
                  </Link>
                </div>
              ))}

              {/* Matching: suggestions, requests and trials live on this page */}
              {learner.accountId && (
                <Link className={styles.secondary} href={`/match/${learner.id}`}>
                  {matches.length ? "Find a tutor for another subject" : "Find a tutor"}
                </Link>
              )}

              {/* A minor waiting on their parent: show the link to send */}
              {isMe && invite?.kind === "parent" && (
                <CopyLink label="Send this link to your parent" url={origin + invitePath(invite.code)} />
              )}

              {/* Account holder: give a learner their own login */}
              {ownsAccount && !isMe && !learner.profileId && (
                invite?.kind === "learner" ? (
                  <CopyLink label={`Send this link to ${learner.name}`} url={origin + invitePath(invite.code)} />
                ) : (
                  <InviteLearnerForm learnerId={learner.id} learnerName={learner.name} />
                )
              )}
              {!isMe && learner.profileId && <p className={styles.hint}>Has their own login.</p>}
            </article>
          );
        })}
      </div>

      {ownsAccount && (
        <section className={styles.fields} aria-labelledby="add-heading">
          <h2 id="add-heading" className={styles.heading}>Add a learner</h2>
          <AddLearnerForm />
        </section>
      )}
    </div>
  );
}
