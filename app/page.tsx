/**
 * Front door, for now: a short Margin Notes page with the two ways in.
 * A full landing page is its own piece of work later.
 */
import Link from "next/link";

import { PaperPage, PenCircle } from "@/components/paper/PaperPage";
import styles from "@/components/paper/paper.module.css";
import { getSignedInUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSignedInUser();

  return (
    <PaperPage
      action={
        user ? (
          <Link className={styles.link} href="/home">Your home</Link>
        ) : (
          <Link className={styles.link} href="/sign-in">Sign in</Link>
        )
      }
    >
      <div className={styles.sheet}>
        <p className={styles.note}>one-on-one tutoring, all in one place</p>
        <h1 className={styles.title}>
          Tutoring that{" "}
          <span className={styles.circled}>
            shows up.
            <PenCircle />
          </span>
        </h1>
        <p className={`${styles.muted} ${styles.lede}`}>
          TutorMe matches your family with a tutor, books the sessions, handles payment, and shows you the
          progress — not just the hours. Standard subjects from $60 an hour.
        </p>
        <div className={styles.row}>
          {user ? (
            <Link className={styles.primary} href="/home">Go to your home</Link>
          ) : (
            <>
              <Link className={styles.primary} href="/sign-up">Create an account</Link>
              <Link className={styles.link} href="/sign-in">I already have one — sign in</Link>
            </>
          )}
        </div>
      </div>
    </PaperPage>
  );
}
