"use client";

import { startTransition, useActionState, type FormEvent } from "react";

import styles from "@/components/paper/paper.module.css";

import { resendCodeAction, verifyCodeAction, type VerifyState } from "./actions";

export function VerifyForm() {
  const [state, formAction, isChecking] = useActionState<VerifyState, FormData>(verifyCodeAction, {});
  const [resendState, resend, isResending] = useActionState<VerifyState>(resendCodeAction, {});

  // Submit by hand so a wrong code doesn't clear the box.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    startTransition(() => formAction(fields));
  }

  const message = state.error ?? resendState.error;

  return (
    <div className={styles.fields}>
      <form onSubmit={handleSubmit} className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.label}>6-digit code</span>
          <input
            className={`${styles.input} ${styles.codeInput}`}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            placeholder="123456"
            required
            autoFocus
          />
        </label>
        {message && <p role="alert" className={styles.error}>{message}</p>}
        {resendState.notice && !message && <p className={styles.note}>{resendState.notice}</p>}
        <button type="submit" className={styles.primary} disabled={isChecking}>
          {isChecking ? "Checking…" : "Verify my email"}
        </button>
      </form>
      <form action={resend}>
        <button type="submit" className={styles.link} disabled={isResending}>
          {isResending ? "Sending…" : "Send me a new code"}
        </button>
      </form>
    </div>
  );
}
