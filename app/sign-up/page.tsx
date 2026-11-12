import Link from "next/link";
import { redirect } from "next/navigation";

import { PaperPage } from "@/components/paper/PaperPage";
import styles from "@/components/paper/paper.module.css";
import { findProfile, getSignedInUser } from "@/lib/auth/current-user";

import { SignUpFlow } from "./SignUpFlow";

export const dynamic = "force-dynamic";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;

  // Already signed in? Skip ahead.
  const user = await getSignedInUser();
  if (user) {
    if (invite) redirect(`/invite/${invite}`);
    redirect((await findProfile(user.id)) ? "/home" : "/sign-up/finish");
  }

  const signInHref = invite ? `/sign-in?next=/invite/${invite}` : "/sign-in";

  return (
    <PaperPage
      action={
        <Link className={styles.link} href={signInHref}>
          Sign in
        </Link>
      }
    >
      <SignUpFlow mode={invite ? "invite" : "new"} inviteCode={invite} />
    </PaperPage>
  );
}
