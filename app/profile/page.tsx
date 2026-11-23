/**
 * Clientee: the tutor's profile, in three compartments:
 *   - the card families see (a live preview),
 *   - everything the tutor can edit (sent to TutorMe for approval),
 *   - their weekly hours as a calendar (live right away; this replaced the
 *     old Hours tab on Nov 19, 2026).
 */
import { redirect } from "next/navigation";

import { HoursCalendar } from "@/components/calendar/HoursCalendar";
import desk from "@/components/desk/desk.module.css";
import { PortalShell } from "@/components/desk/PortalShell";
import matching from "@/components/matching/matching.module.css";
import { PenCircle } from "@/components/paper/PaperPage";
import paper from "@/components/paper/paper.module.css";
import { requireProfile } from "@/lib/auth/current-user";
import { getMyHours } from "@/lib/availability";
import { levelLabel } from "@/lib/matching-options";
import { publicTutorName } from "@/lib/public-name";
import { getMyPublicProfile } from "@/lib/tutor-profile";

import { ProfileDraftForm } from "./ProfileDraftForm";

export const dynamic = "force-dynamic";

export default async function TutorProfilePage() {
  const { user, profile } = await requireProfile();
  if (profile.role !== "tutor") redirect("/home");

  const [card, hours] = await Promise.all([getMyPublicProfile(user), getMyHours(user)]);
  const name = publicTutorName(profile.name);

  return (
    <PortalShell user={user} profile={profile}>
      <div className={paper.sheet}>
        <header className={desk.pageHead}>
          <p className={paper.note}>clientee · this is what families see</p>
          <h1 className={`${paper.title} ${paper.titleSmall}`}>
            Your{" "}
            <span className={paper.circled}>
              profile.
              <PenCircle />
            </span>
          </h1>
        </header>

        {/* ---------- The card families see ---------- */}
        <section className={`${desk.panel} ${desk.panelGreen}`} aria-labelledby="card-heading">
          <h2 id="card-heading" className={desk.panelTab}>your card, live</h2>
          <div className={matching.cards}>
            <article className={`${matching.tutorCard} ${matching.recommended}`} aria-label="Your card as families see it">
              <span className={matching.monogram} aria-hidden>{name[0]}</span>
              <h3 className={matching.tutorName}>{name}</h3>
              {card.schoolYear && <span className={matching.quiet}>{card.schoolYear}</span>}
              <div className={matching.chips}>
                {[...card.subjects, ...card.levels.map(levelLabel)].map((tag) => <span key={tag} className={matching.chip}>{tag}</span>)}
              </div>
              {card.bio ? <p className={matching.bio}>{card.bio}</p> : <p className={matching.quiet}>No bio yet.</p>}
              {card.languages.length > 0 && <span className={matching.quiet}>Teaches in {card.languages.join(", ")}</span>}
              {card.funFact && <span className={matching.quiet}>Fun fact: {card.funFact}</span>}
              {card.introVideoUrl && <span className={matching.quiet}>Intro video: {card.introVideoUrl}</span>}
            </article>
            <div className={paper.fields}>
              {card.hasPendingChanges ? (
                <p className={paper.note}>your latest edits are waiting for TutorMe&apos;s ok. The card shows what&apos;s live now.</p>
              ) : (
                <p className={paper.muted}>Edit anything below and send it to TutorMe. Changes show here once they&apos;re approved.</p>
              )}
              <p className={paper.hint}>Birth date and gender stay private and are set by TutorMe.</p>
            </div>
          </div>
        </section>

        {/* ---------- Everything the tutor can edit ---------- */}
        <ProfileDraftForm
          bio={card.bioDraft ?? card.bio ?? ""}
          introVideoUrl={card.introVideoUrlDraft ?? card.introVideoUrl ?? ""}
          details={card.pendingDetails ?? card.details}
        />

        {/* ---------- Weekly hours ---------- */}
        <section id="hours" className={`${desk.panel} ${desk.panelGreen}`} aria-labelledby="hours-heading">
          <h2 id="hours-heading" className={desk.panelTab}>weekly hours</h2>
          <div className={desk.panelHead}>
            <p className={desk.panelHint}>
              When families can book you, Eastern time. These go live as soon as you save. Removing hours doesn&apos;t cancel
              sessions that are already booked.
            </p>
          </div>
          <HoursCalendar hours={hours} />
        </section>
      </div>
    </PortalShell>
  );
}
