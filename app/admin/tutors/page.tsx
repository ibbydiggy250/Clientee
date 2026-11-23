/**
 * Admin: tutor roster (mvp-spec.md, "Tutor lifecycle" and "Admin console").
 * Invite tutors, see who's active, and extend or end contracts.
 * Contracts ending within 4 weeks get a note in the margin.
 *
 * Laid out as folder panels (Nov 19, 2026 clean-up):
 *   1. To review: tutors' profile edits (bio, video, subjects, levels…)
 *   2. Invites out: links waiting to be accepted
 *   3. Roster: everyone who has joined, with contract and matching drawers
 *   4. Invite a tutor
 */
import { Fragment } from "react";

import paper from "@/components/paper/paper.module.css";
import { daysUntil, getRoster, type RosterTutor } from "@/lib/admin";
import { checkForContactInfo } from "@/lib/contact-filter";
import { invitePath } from "@/lib/invites";
import { levelLabel, MAIN_GOALS, TEACHING_STYLES } from "@/lib/matching-options";
import type { ProfileDetails } from "@/lib/profile-details";
import { siteOrigin } from "@/lib/site-origin";

import { CopyLink } from "../../home/CopyLink";
import { detailsDraftDecisionAction, profileDraftDecisionAction } from "../../match/actions";
import styles from "../admin.module.css";
import { getAdminActor } from "../guard";
import { InviteTutorForm } from "./InviteTutorForm";
import { MatchingProfileForm } from "./MatchingProfileForm";
import { ReissueInviteForm } from "./ReissueInviteForm";
import { TutorTermForm } from "./TutorTermForm";

const ALERT_WINDOW_DAYS = 28;

/** "Mar 3, 2027", or "–". */
function formatDate(isoDate: string | null): string {
  if (!isoDate) return "–";
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The margin note for a contract's end date, if it needs attention. */
function termWarning(tutor: RosterTutor): string | null {
  if (!tutor.termEnd || tutor.status === "inactive" || tutor.status === "invited") return null;
  const days = daysUntil(tutor.termEnd);
  if (days < 0) return `term ended ${-days} day${days === -1 ? "" : "s"} ago`;
  if (days <= ALERT_WINDOW_DAYS) return `term ends in ${days} day${days === 1 ? "" : "s"}, plan the handoff`;
  return null;
}

/** What's still missing before this tutor can appear in suggestions, or null. */
function missingForMatching(tutor: RosterTutor): string | null {
  const missing = [
    tutor.matching.levels.length === 0 && "levels",
    !tutor.matching.birthDate && "birth date",
    tutor.subjects.length === 0 && "subjects",
  ].filter(Boolean);
  return missing.length ? missing.join(", ") : null;
}

function hasPendingDraft(tutor: RosterTutor): boolean {
  return tutor.matching.bioDraft !== null || tutor.matching.introVideoUrlDraft !== null;
}

/** Tutors who accepted their invite (so their contract can be edited). */
type JoinedTutor = RosterTutor & { status: Exclude<RosterTutor["status"], "invited"> };
const hasJoined = (tutor: RosterTutor): tutor is JoinedTutor => tutor.status !== "invited";

function hasAnythingToReview(tutor: RosterTutor): boolean {
  return hasPendingDraft(tutor) || tutor.pendingDetails !== null;
}

// ---------- Showing a profile change as "now → proposed" ----------

const labelOf = (options: readonly { value: string; label: string }[], value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

/** Each detail field as a short line of text, for the now / proposed table. */
const DETAIL_FIELDS: { label: string; show: (details: ProfileDetails) => string }[] = [
  { label: "Subjects", show: (details) => details.subjects.join(", ") },
  { label: "Levels", show: (details) => details.levels.map(levelLabel).join(", ") },
  { label: "Languages", show: (details) => details.languages.join(", ") },
  { label: "School & year", show: (details) => details.schoolYear },
  { label: "Teaching style", show: (details) => details.teachingStyles.map((style) => labelOf(TEACHING_STYLES, style)).join(", ") },
  { label: "Good at", show: (details) => details.goalFocus.map((goal) => labelOf(MAIN_GOALS, goal)).join(", ") },
  { label: "Max learners", show: (details) => String(details.maxLearners) },
  { label: "Fun fact", show: (details) => details.funFact },
];

function ReviewCard({ tutor }: { tutor: RosterTutor }) {
  const pending = tutor.pendingDetails;
  const bioWarning = checkForContactInfo(`${tutor.matching.bioDraft ?? ""} ${pending?.proposed.funFact ?? ""}`);
  const changedFields = pending ? DETAIL_FIELDS.filter((field) => field.show(pending.live) !== field.show(pending.proposed)) : [];

  return (
    <article className={`${styles.card} ${styles.cardUrgent}`}>
      <span className={styles.name}>{tutor.name ?? "Not joined yet"}</span>
      {bioWarning.hold && <span className={styles.margin}>looks like it has a {bioWarning.reasons.join(", ")}, check carefully</span>}

      {hasPendingDraft(tutor) && (
        <form action={profileDraftDecisionAction} className={paper.fields}>
          <input type="hidden" name="tutorId" value={tutor.id} />
          {/* What admin is reading now; only this exact text gets published. */}
          <input type="hidden" name="reviewedBio" value={tutor.matching.bioDraft ?? ""} />
          <input type="hidden" name="reviewedVideo" value={tutor.matching.introVideoUrlDraft ?? ""} />
          <span className={paper.label}>New bio (check for contact details)</span>
          <p className={styles.quote}>“{tutor.matching.bioDraft ?? tutor.matching.bio ?? ""}”</p>
          {tutor.matching.introVideoUrlDraft && <p className={styles.small}>Video: {tutor.matching.introVideoUrlDraft}</p>}
          <div className={styles.cardActions}>
            <button type="submit" name="decision" value="approve" className={`${paper.primary} ${paper.compact}`}>Publish bio</button>
            <button type="submit" name="decision" value="reject" className={`${paper.secondary} ${paper.compact}`}>Send back</button>
          </div>
        </form>
      )}

      {pending && (
        <form action={detailsDraftDecisionAction} className={paper.fields}>
          <input type="hidden" name="tutorId" value={tutor.id} />
          <input type="hidden" name="reviewedDetails" value={pending.fingerprint} />
          <span className={paper.label}>Profile changes</span>
          <div className={styles.diff}>
            <span className={styles.diffHead}>Field</span>
            <span className={styles.diffHead}>Now</span>
            <span className={styles.diffHead}>Proposed</span>
            {changedFields.map((field) => (
              <Fragment key={field.label}>
                <span className={styles.diffField}>{field.label}</span>
                <span className={styles.diffOld}>{field.show(pending.live) || "–"}</span>
                <span className={styles.diffNew}>{field.show(pending.proposed) || "–"}</span>
              </Fragment>
            ))}
          </div>
          <div className={styles.cardActions}>
            <button type="submit" name="decision" value="approve" className={`${paper.primary} ${paper.compact}`}>Publish changes</button>
            <button type="submit" name="decision" value="reject" className={`${paper.secondary} ${paper.compact}`}>Send back</button>
          </div>
        </form>
      )}
    </article>
  );
}

export default async function AdminTutorsPage() {
  const admin = await getAdminActor();
  if (!admin) return null; // the layout already shows "staff only"

  const [roster, origin] = await Promise.all([getRoster(admin), siteOrigin()]);
  const toReview = roster.filter(hasAnythingToReview);
  const invited = roster.filter((tutor) => tutor.status === "invited");
  const joined = roster.filter(hasJoined);
  const endingSoon = joined.filter((tutor) => termWarning(tutor) !== null);

  return (
    <div className={paper.sheet}>
      <p className={paper.note}>who&apos;s teaching</p>
      <h1 className={`${paper.title} ${paper.titleSmall}`}>Tutors.</h1>

      <div className={styles.notes}>
        <a href="#to-review" className={`${styles.sticky} ${styles.jump}`}>
          <span className={styles.stickyNumber}>{toReview.length}</span>
          <span className={styles.stickyLabel}>profiles to review</span>
        </a>
        <a href="#roster" className={`${styles.sticky} ${styles.jump}`}>
          <span className={styles.stickyNumber}>{joined.filter((tutor) => tutor.status === "active").length}</span>
          <span className={styles.stickyLabel}>active tutors</span>
        </a>
        <a href="#roster" className={`${styles.sticky} ${styles.jump}`}>
          <span className={styles.stickyNumber}>{endingSoon.length}</span>
          <span className={styles.stickyLabel}>contracts to watch</span>
        </a>
        <a href="#invites" className={`${styles.sticky} ${styles.jump}`}>
          <span className={styles.stickyNumber}>{invited.length}</span>
          <span className={styles.stickyLabel}>invites out</span>
        </a>
      </div>

      {/* ---------- 1. Profile edits to review ---------- */}
      <section id="to-review" className={`${styles.panel} ${styles.panelPink} ${styles.anchor}`} aria-labelledby="review-heading">
        <h2 id="review-heading" className={styles.panelTab}>
          to review {toReview.length > 0 && <span className={styles.panelCount}>{toReview.length}</span>}
        </h2>
        <p className={styles.panelHint}>Tutors&apos; profile edits reach families only after you publish them.</p>
        {toReview.length === 0 ? (
          <p className={styles.emptyNote}>No profile changes waiting.</p>
        ) : (
          <div className={`${styles.cards} ${styles.cardsFull}`}>{toReview.map((tutor) => <ReviewCard key={tutor.id} tutor={tutor} />)}</div>
        )}
      </section>

      {/* ---------- 2. Invites out ---------- */}
      {invited.length > 0 && (
        <section id="invites" className={`${styles.panel} ${styles.anchor}`} aria-labelledby="invites-heading">
          <h2 id="invites-heading" className={styles.panelTab}>
            invites out <span className={styles.panelCount}>{invited.length}</span>
          </h2>
          <div className={`${styles.cards} ${styles.cardsWide}`}>
            {invited.map((tutor) => (
              <article key={tutor.id} className={`${styles.card} ${styles.cardWaiting}`}>
                <div className={styles.cardTop}>
                  <span className={styles.name}>{tutor.email ?? "No pending invite"}</span>
                  <span className={`${styles.statusChip} ${styles.status_invited}`}>invited</span>
                </div>
                {tutor.pendingInviteCode ? (
                  <CopyLink label="Their invite link" url={origin + invitePath(tutor.pendingInviteCode)} />
                ) : (
                  <p className={styles.small}>Their invite expired or was cancelled.</p>
                )}
                <details className={styles.drawer}>
                  <summary>Send a new link</summary>
                  <div className={styles.drawerBody}>
                    <ReissueInviteForm tutorId={tutor.id} currentEmail={tutor.email} origin={origin} />
                  </div>
                </details>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ---------- 3. Roster ---------- */}
      <section id="roster" className={`${styles.panel} ${styles.panelBlue} ${styles.anchor}`} aria-labelledby="roster-heading">
        <h2 id="roster-heading" className={styles.panelTab}>
          roster {joined.length > 0 && <span className={styles.panelCount}>{joined.length}</span>}
        </h2>
        {joined.length === 0 ? (
          <p className={styles.emptyNote}>No tutors have joined yet. Invite your first one below.</p>
        ) : (
          <div className={`${styles.cards} ${styles.cardsWide}`}>
            {joined.map((tutor) => {
              const warning = termWarning(tutor);
              const missing = tutor.status === "active" ? missingForMatching(tutor) : null;
              return (
                <article key={tutor.id} className={`${styles.card} ${warning || missing ? styles.cardWaiting : styles.cardDone}`}>
                  <div className={styles.cardTop}>
                    <span className={styles.name}>{tutor.name ?? "Not joined yet"}</span>
                    <span className={`${styles.statusChip} ${styles[`status_${tutor.status}`]}`}>{tutor.status}</span>
                  </div>
                  <span className={styles.small}>{tutor.email}</span>
                  <div className={styles.cardFacts}>
                    {tutor.subjects.length === 0 ? (
                      <span className={styles.fact}>no subjects yet</span>
                    ) : (
                      tutor.subjects.map((subject) => <span key={subject} className={styles.fact}>{subject}</span>)
                    )}
                    <span className={styles.fact}>
                      {tutor.activeLearners} learner{tutor.activeLearners === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className={styles.small}>
                    Contract {formatDate(tutor.termStart)} → {formatDate(tutor.termEnd)}
                  </span>
                  {warning && <span className={styles.margin}>{warning}</span>}
                  {missing && <span className={styles.margin}>not in suggestions yet: add {missing}</span>}
                  {hasAnythingToReview(tutor) && <span className={styles.margin}>profile changes waiting for your ok ↑</span>}

                  <details className={styles.drawer}>
                    <summary>Edit contract</summary>
                    <div className={styles.drawerBody}>
                      <TutorTermForm tutorId={tutor.id} termEnd={tutor.termEnd} status={tutor.status} />
                    </div>
                  </details>
                  <details className={styles.drawer}>
                    <summary>Matching profile</summary>
                    <div className={styles.drawerBody}>
                      <MatchingProfileForm tutorId={tutor.id} profile={tutor.matching} />
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------- 4. Invite a tutor ---------- */}
      <section className={`${styles.panel} ${styles.panelGreen}`} aria-labelledby="invite-heading">
        <h2 id="invite-heading" className={styles.panelTab}>invite a tutor</h2>
        <p className={styles.panelHint}>Send this once their contract is signed. They&apos;ll set a password and land in Clientee.</p>
        <InviteTutorForm origin={origin} />
      </section>
    </div>
  );
}
