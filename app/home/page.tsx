/**
 * /home — the first tab of each desk.
 *   Families → FamilyHome (the week at a glance)
 *   Tutors   → TutorHome  (Clientee's "Today")
 *   Admins   → a pointer to the admin console
 * Both desks are wrapped in PortalShell (stamp + tabs). Learner cards,
 * invites and sessions, which used to live on this page, are on the
 * Learners and Sessions tabs now.
 */
import Link from "next/link";

import { PortalShell } from "@/components/desk/PortalShell";
import { PaperPage } from "@/components/paper/PaperPage";
import styles from "@/components/paper/paper.module.css";
import { requireProfile } from "@/lib/auth/current-user";
import { getFamilyDesk } from "@/lib/family";

import { FamilyHome } from "./FamilyHome";
import { SignOutButton } from "./SignOutButton";
import { TutorHome } from "./TutorHome";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { user, profile } = await requireProfile();

  if (profile.role === "admin") {
    return (
      <PaperPage action={<SignOutButton />}>
        <div className={`${styles.sheet} ${styles.narrow}`}>
          <p className={styles.note}>hi {profile.name.split(" ")[0].toLowerCase()} —</p>
          <h1 className={`${styles.title} ${styles.titleSmall}`}>You&apos;re signed in as staff.</h1>
          <Link className={styles.primary} href="/admin">
            Open the admin console
          </Link>
        </div>
      </PaperPage>
    );
  }

  return (
    <PortalShell user={user} profile={profile}>
      {profile.role === "tutor" ? (
        <TutorHome profile={profile} />
      ) : (
        <FamilyHome user={user} profile={profile} desk={await getFamilyDesk(user)} />
      )}
    </PortalShell>
  );
}
