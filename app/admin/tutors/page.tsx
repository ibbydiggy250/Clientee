/**
 * Admin: tutor roster (mvp-spec.md, "Tutor lifecycle" and "Admin console").
 * Invite tutors, see who's active, and extend or end contracts.
 * Contracts ending within 4 weeks get a note in the margin.
 */
import paper from "@/components/paper/paper.module.css";
import { daysUntil, getRoster, type RosterTutor } from "@/lib/admin";
import { invitePath } from "@/lib/invites";
import { siteOrigin } from "@/lib/site-origin";

import { CopyLink } from "../../home/CopyLink";
import styles from "../admin.module.css";
import { getAdminActor } from "../guard";
import { profileDraftDecisionAction } from "../../match/actions";
import { InviteTutorForm } from "./InviteTutorForm";
import { MatchingProfileForm } from "./MatchingProfileForm";
import { ReissueInviteForm } from "./ReissueInviteForm";
import { TutorTermForm } from "./TutorTermForm";

const ALERT_WINDOW_DAYS = 28;

/** "Mar 3, 2027", or "—". */
function formatDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The margin note for a contract's end date, if it needs attention. */
function termWarning(tutor: RosterTutor): string | null {
  if (!tutor.termEnd || tutor.status === "inactive" || tutor.status === "invited") return null;
  const days = daysUntil(tutor.termEnd);
  if (days < 0) return `term ended ${-days} day${days === -1 ? "" : "s"} ago`;
  if (days <= ALERT_WINDOW_DAYS) return `term ends in ${days} day${days === 1 ? "" : "s"} — plan the handoff`;
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

export default async function AdminTutorsPage() {
  const admin = await getAdminActor();
  if (!admin) return null; // the layout already shows "staff only"

  const [roster, origin] = await Promise.all([getRoster(admin), siteOrigin()]);

  return (
    <div className={paper.sheet}>
      <p className={paper.note}>who&apos;s teaching</p>
      <h1 className={`${paper.title} ${paper.titleSmall}`}>Tutors.</h1>

      <section className={paper.fields} aria-labelledby="roster-heading">
        <h2 id="roster-heading" className={paper.heading}>Roster</h2>
        {roster.length === 0 ? (
          <p className={paper.muted}>No tutors yet. Invite your first one below.</p>
        ) : (
          <div className={styles.ledger} style={{ "--columns": "1.5fr 1.2fr 1.1fr 0.6fr" } as React.CSSProperties}>
            <div className={styles.ledgerHead}>
              <span>Tutor</span>
              <span>Subjects</span>
              <span>Contract</span>
              <span>Learners</span>
            </div>
            {roster.map((tutor) => {
              const warning = termWarning(tutor);
              return (
                <div key={tutor.id} className={styles.ledgerRow}>
                  <div className={paper.field}>
                    <span className={styles.name}>{tutor.name ?? "Not joined yet"}</span>
                    <span className={styles.small}>{tutor.email ?? "no pending invite"}</span>
                    <span className={`${styles.statusChip} ${styles[`status_${tutor.status}`]}`}>{tutor.status}</span>
                  </div>
                  <span>{tutor.subjects.join(", ") || "—"}</span>
                  <div className={paper.field}>
                    <span className={styles.small}>
                      {formatDate(tutor.termStart)} → {formatDate(tutor.termEnd)}
                    </span>
                    {warning && <span className={styles.margin}>{warning}</span>}
                    {tutor.status === "active" && missingForMatching(tutor) && (
                      <span className={styles.margin}>not in suggestions yet: add {missingForMatching(tutor)}</span>
                    )}
                    {hasPendingDraft(tutor) && <span className={styles.margin}>new bio waiting for your ok</span>}
                  </div>
                  <span className={styles.money}>{tutor.activeLearners}</span>

                  <details className={styles.drawer} style={{ gridColumn: "1 / -1" }}>
                    <summary>{tutor.status === "invited" ? "Invite link" : "Edit contract"}</summary>
                    <div className={styles.drawerBody}>
                      {tutor.status === "invited" ? (
                        <>
                          {tutor.pendingInviteCode ? (
                            <CopyLink label="Their invite link" url={origin + invitePath(tutor.pendingInviteCode)} />
                          ) : (
                            <p className={styles.small}>Their invite expired or was cancelled.</p>
                          )}
                          <ReissueInviteForm tutorId={tutor.id} currentEmail={tutor.email} origin={origin} />
                        </>
                      ) : (
                        <TutorTermForm tutorId={tutor.id} termEnd={tutor.termEnd} status={tutor.status} />
                      )}
                    </div>
                  </details>

                  {tutor.status !== "invited" && (
                    <details className={styles.drawer} style={{ gridColumn: "1 / -1" }}>
                      <summary>Matching profile{hasPendingDraft(tutor) ? " · bio to review" : ""}</summary>
                      <div className={styles.drawerBody}>
                        {hasPendingDraft(tutor) && (
                          <form action={profileDraftDecisionAction} className={paper.fields}>
                            <input type="hidden" name="tutorId" value={tutor.id} />
                            {/* What admin is reading now; only this exact text gets published. */}
                            <input type="hidden" name="reviewedBio" value={tutor.matching.bioDraft ?? ""} />
                            <input type="hidden" name="reviewedVideo" value={tutor.matching.introVideoUrlDraft ?? ""} />
                            <span className={paper.label}>New bio from the tutor (check for contact details)</span>
                            <p className={styles.small}>“{tutor.matching.bioDraft ?? tutor.matching.bio ?? ""}”</p>
                            {tutor.matching.introVideoUrlDraft && (
                              <p className={styles.small}>Video: {tutor.matching.introVideoUrlDraft}</p>
                            )}
                            <div className={paper.row}>
                              <button type="submit" name="decision" value="approve" className={paper.primary}>Publish it</button>
                              <button type="submit" name="decision" value="reject" className={paper.secondary}>Send back</button>
                            </div>
                          </form>
                        )}
                        <MatchingProfileForm tutorId={tutor.id} profile={tutor.matching} />
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={paper.fields} aria-labelledby="invite-heading">
        <h2 id="invite-heading" className={paper.heading}>Invite a tutor</h2>
        <p className={paper.muted}>Send this once their contract is signed. They&apos;ll set a password and land in Clientee.</p>
        <InviteTutorForm origin={origin} />
      </section>
    </div>
  );
}
