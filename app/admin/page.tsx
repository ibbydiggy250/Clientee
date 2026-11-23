/**
 * Admin: intake queue and matching (mvp-spec.md, "Admin console").
 * Match requests from the rule-based flow wait here for approval; any
 * learner can still be matched by hand as an override.
 *
 * Laid out as folder panels, most urgent first (Nov 19, 2026 clean-up):
 *   1. Your call: tutor said yes, admin approves or declines
 *   2. Waiting on the tutor: requests inside their 48 hours
 *   3. Needs a tutor: learners with no match yet (hand-match from the card)
 *   4. Matched: learners who have tutors (add another subject by hand)
 *   5. Waiting for a parent, and recent matches
 * The sticky notes at the top jump to their panel.
 */
import paper from "@/components/paper/paper.module.css";
import { getIntake, getRecentMatches, getRoster, type IntakeLearner, type MatchableTutor } from "@/lib/admin";
import { formatSessionTime } from "@/lib/eastern-time";
import { getOpenRequests } from "@/lib/matching";
import { levelLabel } from "@/lib/matching-options";

import styles from "./admin.module.css";
import { DecideMatchButtons } from "./DecideMatchButtons";
import { dollars, getAdminActor } from "./guard";
import { MatchForm } from "./MatchForm";

type OpenRequest = Awaited<ReturnType<typeof getOpenRequests>>[number];

/** One match request as a card. */
function RequestCard({ request }: { request: OpenRequest }) {
  const isYourCall = request.status === "accepted";
  return (
    <article className={`${styles.card} ${isYourCall ? styles.cardUrgent : styles.cardWaiting}`}>
      <span className={styles.name}>
        {request.learnerName} → {request.tutorName}
      </span>
      <div className={styles.cardFacts}>
        <span className={styles.fact}>{request.subject}</span>
        <span className={styles.fact}>{levelLabel(request.level)}</span>
        <span className={styles.fact}>score {request.score}</span>
      </div>
      {request.notes && <p className={styles.quote}>“{request.notes}”</p>}
      {isYourCall ? (
        <span className={styles.margin}>tutor said yes, your call</span>
      ) : (
        <span className={styles.small}>Tutor has until {request.expiresAt ? formatSessionTime(request.expiresAt) : "–"} ET</span>
      )}
      <DecideMatchButtons requestId={request.id} canApprove={isYourCall} />
    </article>
  );
}

/** One learner as a card, with hand-matching tucked into a drawer. */
function LearnerCard({ learner, tutors }: { learner: IntakeLearner; tutors: MatchableTutor[] }) {
  const needsTutor = learner.matches.length === 0;
  return (
    <article className={`${styles.card} ${needsTutor ? styles.cardUrgent : styles.cardDone}`}>
      <div className={styles.cardTop}>
        <span className={styles.name}>{learner.name}</span>
        <span className={styles.small}>{[learner.grade, learner.isMinor ? "under 18" : "18+"].filter(Boolean).join(" · ")}</span>
      </div>
      {learner.subjects.length > 0 && (
        <div className={styles.cardFacts}>
          {learner.subjects.map((subject) => (
            <span key={subject} className={styles.fact}>{subject}</span>
          ))}
        </div>
      )}
      {learner.goals && <p className={styles.quote}>“{learner.goals}”</p>}
      {learner.unmetSearch && (
        <span className={styles.margin}>
          searched {learner.unmetSearch.subject} ({levelLabel(learner.unmetSearch.level)}), no tutor fit, match by hand
        </span>
      )}
      {learner.matches.map((match) => (
        <span key={match.subject} className={styles.small}>
          ✓ {match.subject} with {match.tutorName} ({dollars(match.rateCents)}/hr)
        </span>
      ))}
      <span className={styles.small}>
        Account holder: {learner.holderName ?? "–"}
        {learner.holderEmail && ` · ${learner.holderEmail}`}
      </span>
      <details className={styles.drawer}>
        <summary>{needsTutor ? "Match by hand" : "Add another subject by hand"}</summary>
        <div className={styles.drawerBody}>
          <MatchForm learnerId={learner.id} learnerName={learner.name} suggestedSubjects={learner.subjects} tutors={tutors} />
        </div>
      </details>
    </article>
  );
}

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

  const yourCall = openRequests.filter((request) => request.status === "accepted");
  const waitingOnTutor = openRequests.filter((request) => request.status !== "accepted");
  const needsTutor = learners.filter((learner) => learner.matches.length === 0);
  const matched = learners.filter((learner) => learner.matches.length > 0);
  const pendingTutorInvites = roster.filter((tutor) => tutor.status === "invited").length;

  return (
    <div className={paper.sheet}>
      <p className={paper.note}>today&apos;s desk</p>
      <h1 className={`${paper.title} ${paper.titleSmall}`}>Intake &amp; matching.</h1>

      <div className={styles.notes}>
        <a href="#your-call" className={`${styles.sticky} ${styles.jump}`}>
          <span className={styles.stickyNumber}>{yourCall.length}</span>
          <span className={styles.stickyLabel}>matches waiting for your ok</span>
        </a>
        <a href="#needs-tutor" className={`${styles.sticky} ${styles.jump}`}>
          <span className={styles.stickyNumber}>{needsTutor.length}</span>
          <span className={styles.stickyLabel}>waiting for a tutor</span>
        </a>
        <a href="#waiting-parent" className={`${styles.sticky} ${styles.jump}`}>
          <span className={styles.stickyNumber}>{waitingForParent.length}</span>
          <span className={styles.stickyLabel}>waiting for a parent</span>
        </a>
        <div className={styles.sticky}>
          <span className={styles.stickyNumber}>{activeTutors.length}</span>
          <span className={styles.stickyLabel}>active tutors · {pendingTutorInvites} invites out</span>
        </div>
      </div>

      {/* ---------- 1. Your call ---------- */}
      <section id="your-call" className={`${styles.panel} ${styles.panelPink} ${styles.anchor}`} aria-labelledby="call-heading">
        <h2 id="call-heading" className={styles.panelTab}>
          your call {yourCall.length > 0 && <span className={styles.panelCount}>{yourCall.length}</span>}
        </h2>
        <p className={styles.panelHint}>The tutor said yes. Approving opens messaging and the trial session.</p>
        {yourCall.length === 0 ? (
          <p className={styles.emptyNote}>Nothing to approve right now.</p>
        ) : (
          <div className={styles.cards}>{yourCall.map((request) => <RequestCard key={request.id} request={request} />)}</div>
        )}
      </section>

      {/* ---------- 2. Waiting on the tutor ---------- */}
      {waitingOnTutor.length > 0 && (
        <section className={styles.panel} aria-labelledby="tutor-heading">
          <h2 id="tutor-heading" className={styles.panelTab}>
            waiting on the tutor <span className={styles.panelCount}>{waitingOnTutor.length}</span>
          </h2>
          <p className={styles.panelHint}>Tutors have 48 hours to answer. You can decline for them.</p>
          <div className={styles.cards}>{waitingOnTutor.map((request) => <RequestCard key={request.id} request={request} />)}</div>
        </section>
      )}

      {/* ---------- 3. Needs a tutor ---------- */}
      <section id="needs-tutor" className={`${styles.panel} ${styles.panelBlue} ${styles.anchor}`} aria-labelledby="needs-heading">
        <h2 id="needs-heading" className={styles.panelTab}>
          needs a tutor {needsTutor.length > 0 && <span className={styles.panelCount}>{needsTutor.length}</span>}
        </h2>
        {learners.length === 0 ? (
          <p className={styles.emptyNote}>No families yet. They&apos;ll appear here as soon as they sign up.</p>
        ) : needsTutor.length === 0 ? (
          <p className={styles.emptyNote}>Everyone has a tutor.</p>
        ) : (
          <div className={`${styles.cards} ${styles.cardsWide}`}>
            {needsTutor.map((learner) => <LearnerCard key={learner.id} learner={learner} tutors={activeTutors} />)}
          </div>
        )}
      </section>

      {/* ---------- 4. Matched ---------- */}
      {matched.length > 0 && (
        <section className={`${styles.panel} ${styles.panelGreen}`} aria-labelledby="matched-heading">
          <h2 id="matched-heading" className={styles.panelTab}>
            matched <span className={styles.panelCount}>{matched.length}</span>
          </h2>
          <div className={`${styles.cards} ${styles.cardsWide}`}>
            {matched.map((learner) => <LearnerCard key={learner.id} learner={learner} tutors={activeTutors} />)}
          </div>
        </section>
      )}

      {/* ---------- 5a. Minors without a parent yet ---------- */}
      {waitingForParent.length > 0 && (
        <section id="waiting-parent" className={`${styles.panel} ${styles.panelPaper} ${styles.anchor}`} aria-labelledby="waiting-heading">
          <h2 id="waiting-heading" className={styles.panelTab}>
            waiting for a parent <span className={styles.panelCount}>{waitingForParent.length}</span>
          </h2>
          <p className={styles.panelHint}>These minors signed up on their own. They can&apos;t be matched until a parent accepts their link.</p>
          <div className={styles.cards}>
            {waitingForParent.map((learner) => (
              <article key={learner.id} className={`${styles.card} ${styles.cardWaiting}`}>
                <span className={styles.name}>{learner.name}</span>
                <span className={styles.small}>
                  {learner.grade ?? "–"} · signed up {learner.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ---------- 5b. Recent matches ---------- */}
      {recentMatches.length > 0 && (
        <section className={`${styles.panel} ${styles.panelPaper}`} aria-labelledby="recent-heading">
          <h2 id="recent-heading" className={styles.panelTab}>recent matches</h2>
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
