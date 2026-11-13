/**
 * Clientee: the tutor's public profile — what families see on suggestion
 * cards. Bio and video edits go live after TutorMe approves them.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import matching from "@/components/matching/matching.module.css";
import { PaperPage, PenCircle } from "@/components/paper/PaperPage";
import paper from "@/components/paper/paper.module.css";
import { requireProfile } from "@/lib/auth/current-user";
import { levelLabel } from "@/lib/matching-options";
import { publicTutorName } from "@/lib/public-name";
import { getMyPublicProfile } from "@/lib/tutor-profile";

import { SignOutButton } from "../home/SignOutButton";
import { ProfileDraftForm } from "./ProfileDraftForm";

export const dynamic = "force-dynamic";

export default async function TutorProfilePage() {
  const { user, profile } = await requireProfile();
  if (profile.role !== "tutor") redirect("/home");

  const card = await getMyPublicProfile(user);
  const name = publicTutorName(profile.name);

  return (
    <PaperPage action={<SignOutButton />}>
      <div className={paper.sheet}>
        <p className={paper.note}>clientee · this is what families see</p>
        <h1 className={`${paper.title} ${paper.titleSmall}`}>
          Your public{" "}
          <span className={paper.circled}>
            profile.
            <PenCircle />
          </span>
        </h1>

        <div className={matching.cards}>
          {/* A live preview of the card families see */}
          <article className={`${matching.tutorCard} ${matching.recommended}`} aria-label="Your card as families see it">
            <span className={matching.monogram} aria-hidden>{name[0]}</span>
            <h2 className={matching.tutorName}>{name}</h2>
            {card.schoolYear && <span className={matching.quiet}>{card.schoolYear}</span>}
            <div className={matching.chips}>
              {[...card.subjects, ...card.levels.map(levelLabel)].map((tag) => <span key={tag} className={matching.chip}>{tag}</span>)}
            </div>
            {card.bio ? <p className={matching.bio}>{card.bio}</p> : <p className={matching.quiet}>No bio yet.</p>}
            {card.introVideoUrl && <span className={matching.quiet}>Intro video: {card.introVideoUrl}</span>}
          </article>

          <div className={paper.fields}>
            {card.hasPendingChanges && (
              <p className={paper.note}>your latest edits are waiting for TutorMe&apos;s ok</p>
            )}
            <ProfileDraftForm bio={card.bioDraft ?? card.bio ?? ""} introVideoUrl={card.introVideoUrlDraft ?? card.introVideoUrl ?? ""} />
            <p className={paper.hint}>Subjects, levels and school are set by TutorMe. Ask us to change them.</p>
          </div>
        </div>

        <Link className={paper.link} href="/home">← Back to Clientee</Link>
      </div>
    </PaperPage>
  );
}
