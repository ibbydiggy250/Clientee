/**
 * Admin: intake queue and matching (mvp-spec.md, "Admin console").
 * Match requests from the rule-based flow wait here for approval; any
 * learner can still be matched by hand as an override.
 */
import paper from "@/components/paper/paper.module.css";
import { getIntake, getRecentMatches, getRoster } from "@/lib/admin";
import { formatSessionTime } from "@/lib/eastern-time";
import { getOpenRequests } from "@/lib/matching";
import { levelLabel } from "@/lib/matching-options";

import styles from "./admin.module.css";
import { DecideMatchButtons } from "./DecideMatchButtons";
import { dollars, getAdminActor } from "./guard";
import { MatchForm } from "./MatchForm";

export default async function AdminIntakePage() {
  const admin = await getAdminActor();
  if (!admin) return null; // the layout already shows "staff only"

  const [{ learners, waitingForParent, activeTutors }, recentMatches, roster] = await Promise.all([
    getIntake(admin),
    getRecentMatches(admin),
    getRoster(admin),
  ]);
  // Read after the admin check above (getIntake asserts admin).
  const openRequests = await getOpenRequests(admin, new Date());

  const unmatchedCount = learners.filter((learner) => learner.matches.length === 0).length;
  const pendingTutorInvites = roster.filter((tutor) => tutor.status === "invited").length;

  return (
    <div className={paper.sheet}>
      <p className={paper.note}>today&apos;s desk</p>
      <h1 className={`${paper.title} ${paper.titleSmall}`}>Intake &amp; matching.</h1>

      <div className={styles.notes}>
        <div className={styles.sticky}>
          <span className={styles.stickyNumber}>{unmatchedCount}</span>
          <span className={styles.stickyLabel}>waiting for a tutor</span>
        </div>
        <div className={styles.sticky}>
          <span className={styles.stickyNumber}>{waitingForParent.length}</span>
          <span className={styles.stickyLabel}>waiting for a parent</span>
        </div>
        <div className={styles.sticky}>
          <span className={styles.stickyNumber}>{activeTutors.length}</span>
          <span className={styles.stickyLabel}>active tutors</span>
        </div>
        <div className={styles.sticky}>
          <span className={styles.stickyNumber}>{pendingTutorInvites}</span>
          <span className={styles.stickyLabel}>tutor invites out</span>
        </div>
      </div>

      {/* ---------- Match requests: waiting on the tutor or on approval ---------- */}
      {openRequests.length > 0 && (
        <section className={paper.fields} aria-labelledby="requests-heading">
          <h2 id="requests-heading" className={paper.heading}>Match requests</h2>
          <div className={styles.ledger} style={{ "--columns": "1.2fr 1.2fr 1fr" } as React.CSSProperties}>
            <div className={styles.ledgerHead}>
              <span>Learner → tutor</span>
              <span>Family&apos;s notes</span>
              <span>Status</span>
            </div>
            {openRequests.map((request) => (
              <div key={request.id} className={styles.ledgerRow}>
                <div className={paper.field}>
                  <span className={styles.name}>{request.learnerName} → {request.tutorName}</span>
                  <span className={styles.small}>
                    {request.subject} · {request.level} · score {request.score}
                  </span>
                </div>
                <span className={styles.small}>{request.notes ? `“${request.notes}”` : "—"}</span>
                <div className={paper.field}>
                  {request.status === "accepted" ? (
                    <span className={styles.margin}>tutor said yes — your call</span>
                  ) : (
                    <span className={styles.small}>
                      Waiting for the tutor · until {request.expiresAt ? formatSessionTime(request.expiresAt) : "—"} ET
                    </span>
                  )}
                  <DecideMatchButtons requestId={request.id} canApprove={request.status === "accepted"} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- The queue ---------- */}
      <section className={paper.fields} aria-labelledby="queue-heading">
        <h2 id="queue-heading" className={paper.heading}>Learners</h2>
        {learners.length === 0 ? (
          <p className={paper.muted}>No families yet. They&apos;ll appear here as soon as they sign up.</p>
        ) : (
          <div className={styles.ledger} style={{ "--columns": "1.4fr 1.4fr 1fr" } as React.CSSProperties}>
            <div className={styles.ledgerHead}>
              <span>Learner</span>
              <span>Wants</span>
              <span>Account holder</span>
            </div>
            {learners.map((learner) => (
              <div key={learner.id} className={styles.ledgerRow}>
                <div className={paper.field}>
                  <span className={styles.name}>{learner.name}</span>
                  <span className={styles.small}>
                    {[learner.grade, learner.isMinor ? "under 18" : "18+"].filter(Boolean).join(" · ")}
                  </span>
                  {learner.unmetSearch && (
                    <span className={styles.margin}>
                      searched {learner.unmetSearch.subject} ({levelLabel(learner.unmetSearch.level)}) — no tutor fit, match by hand
                    </span>
                  )}
                  {learner.matches.length === 0 ? (
                    <span className={styles.margin}>needs a tutor!</span>
                  ) : (
                    learner.matches.map((match) => (
                      <span key={match.subject} className={styles.small}>
                        ✓ {match.subject} with {match.tutorName} ({dollars(match.rateCents)}/hr)
                      </span>
                    ))
                  )}
                </div>
                <div className={paper.field}>
                  <span>{learner.subjects.join(", ") || "—"}</span>
                  {learner.goals && <span className={styles.small}>“{learner.goals}”</span>}
                </div>
                <div className={paper.field}>
                  <span>{learner.holderName}</span>
                  <span className={styles.small}>{learner.holderEmail}</span>
                </div>
                <details className={styles.drawer} style={{ gridColumn: "1 / -1" }}>
                  <summary>{learner.matches.length === 0 ? "Match by hand" : "Add another subject by hand"}</summary>
                  <div className={styles.drawerBody}>
                    <MatchForm
                      learnerId={learner.id}
                      learnerName={learner.name}
                      suggestedSubjects={learner.subjects}
                      tutors={activeTutors}
                    />
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Minors without a parent yet ---------- */}
      {waitingForParent.length > 0 && (
        <section className={paper.fields} aria-labelledby="waiting-heading">
          <h2 id="waiting-heading" className={paper.heading}>Waiting for a parent to link</h2>
          <p className={paper.muted}>
            These minors signed up on their own. They can&apos;t be matched until a parent accepts their link.
          </p>
          <div className={styles.ledger} style={{ "--columns": "1.4fr 1fr" } as React.CSSProperties}>
            {waitingForParent.map((learner) => (
              <div key={learner.id} className={styles.ledgerRow}>
                <span className={styles.name}>{learner.name}</span>
                <span className={styles.small}>
                  {learner.grade ?? "—"} · signed up {learner.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- Recent matches ---------- */}
      {recentMatches.length > 0 && (
        <section className={paper.fields} aria-labelledby="recent-heading">
          <h2 id="recent-heading" className={paper.heading}>Recent matches</h2>
          <div className={styles.ledger} style={{ "--columns": "1.2fr 1fr 1.2fr 0.6fr" } as React.CSSProperties}>
            <div className={styles.ledgerHead}>
              <span>Learner</span>
              <span>Subject</span>
              <span>Tutor</span>
              <span>Rate</span>
            </div>
            {recentMatches.map((match) => (
              <div key={match.id} className={styles.ledgerRow}>
                <span className={styles.name}>{match.learnerName}</span>
                <span>
                  {match.subject}
                  {match.tier === "premium" && <span className={styles.small}> · premium</span>}
                </span>
                <span>{match.tutorName}</span>
                <span className={styles.money}>{dollars(match.rateCents)}/hr</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
