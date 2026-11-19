/** Learners tab: families see their learners; tutors see who they teach. */
import { redirect } from "next/navigation";

import { PortalShell } from "@/components/desk/PortalShell";
import { requireProfile } from "@/lib/auth/current-user";
import { getFamilyDesk } from "@/lib/family";
import { getTutorDesk } from "@/lib/tutor-desk";

import { FamilyLearners } from "./FamilyLearners";
import { TutorLearners } from "./TutorLearners";

export const dynamic = "force-dynamic";

export default async function LearnersPage() {
  const { user, profile } = await requireProfile();
  if (profile.role === "admin") redirect("/admin");

  return (
    <PortalShell user={user} profile={profile}>
      {profile.role === "tutor" ? (
        <TutorLearners desk={await getTutorDesk(profile, new Date())} />
      ) : (
        <FamilyLearners user={user} desk={await getFamilyDesk(user)} />
      )}
    </PortalShell>
  );
}
