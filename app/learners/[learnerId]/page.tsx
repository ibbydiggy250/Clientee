/**
 * A learner's own page, opened from the Learners tab. Tutors get the Clientee
 * learner file; families get their learner's page. Each sees different things
 * (see lib/learner-page.ts). Anyone who can't see this learner gets a 404.
 */
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { PortalShell } from "@/components/desk/PortalShell";
import { requireProfile } from "@/lib/auth/current-user";
import { getFamilyLearnerPage, getTutorLearnerPage } from "@/lib/learner-page";

import { FamilyLearnerView } from "./FamilyLearnerView";
import { TutorLearnerView } from "./TutorLearnerView";

export const dynamic = "force-dynamic";

export default async function LearnerPage({ params }: { params: Promise<{ learnerId: string }> }) {
  const { user, profile } = await requireProfile();
  if (profile.role === "admin") redirect("/admin");

  const learnerId = z.uuid().safeParse((await params).learnerId);
  if (!learnerId.success) notFound();

  const now = new Date();
  if (profile.role === "tutor") {
    const page = await getTutorLearnerPage(user, learnerId.data, now);
    if (!page) notFound();
    return (
      <PortalShell user={user} profile={profile}>
        <TutorLearnerView page={page} now={now} />
      </PortalShell>
    );
  }

  const page = await getFamilyLearnerPage(user, learnerId.data, now);
  if (!page) notFound();
  return (
    <PortalShell user={user} profile={profile}>
      <FamilyLearnerView page={page} now={now} />
    </PortalShell>
  );
}
