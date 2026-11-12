/**
 * "Check your email": the person types the 6-digit code Neon Auth emailed
 * them. Reached right after sign-up, or after signing in with an email that
 * hasn't been verified yet.
 */
import { redirect } from "next/navigation";

import { PaperPage, PenCircle } from "@/components/paper/PaperPage";
import styles from "@/components/paper/paper.module.css";
import { readPendingVerification } from "@/lib/auth/pending-verification";
import { maskEmail } from "@/lib/mask-email";

import { VerifyForm } from "./VerifyForm";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const pending = await readPendingVerification();
  if (!pending) redirect("/sign-in");

  return (
    <PaperPage>
      <div className={`${styles.sheet} ${styles.narrow}`}>
        <p className={styles.note}>almost there</p>
        <h1 className={`${styles.title} ${styles.titleSmall}`}>
          Check your{" "}
          <span className={styles.circled}>
            email.
            <PenCircle />
          </span>
        </h1>
        <p>
          We sent a 6-digit code to <strong>{maskEmail(pending.email)}</strong>. Enter it below to prove the
          email is yours.
        </p>
        <VerifyForm />
      </div>
    </PaperPage>
  );
}
