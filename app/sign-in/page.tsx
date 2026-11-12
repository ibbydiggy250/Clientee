import Link from "next/link";
import { redirect } from "next/navigation";

import { PaperPage, PenCircle } from "@/components/paper/PaperPage";
import styles from "@/components/paper/paper.module.css";
import { getSignedInUser } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/safe-path";

import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getSignedInUser()) redirect(safeNextPath(next));

  // Coming from an invite? Offer to make a login for it instead.
  const inviteCode = next?.match(/^\/invite\/([\w-]+)$/)?.[1];
  const signUpHref = inviteCode ? `/sign-up?invite=${inviteCode}` : "/sign-up";

  return (
    <PaperPage
      action={
        <Link className={styles.link} href={signUpHref}>
          Create an account
        </Link>
      }
    >
      <div className={`${styles.sheet} ${styles.narrow}`}>
        <p className={styles.note}>good to see you again</p>
        <h1 className={`${styles.title} ${styles.titleSmall}`}>
          Welcome{" "}
          <span className={styles.circled}>
            back.
            <PenCircle />
          </span>
        </h1>
        <SignInForm next={next} />
      </div>
    </PaperPage>
  );
}
