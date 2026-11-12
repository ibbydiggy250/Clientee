"use client";

import { startTransition, useActionState, type FormEvent } from "react";

import styles from "@/components/paper/paper.module.css";

import { signInAction, type SignInState } from "./actions";

export function SignInForm({ next }: { next?: string }) {
  const [state, formAction, isSaving] = useActionState<SignInState, FormData>(signInAction, {});

  // Submit by hand so a wrong password doesn't also clear the email field.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    startTransition(() => formAction(fields));
  }

  return (
    <form onSubmit={handleSubmit} className={styles.fields}>
      {next && <input type="hidden" name="next" value={next} />}
      {/* The server re-checks `next` with safeNextPath before redirecting. */}
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input className={styles.input} type="email" name="email" autoComplete="email" required />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <input className={styles.input} type="password" name="password" autoComplete="current-password" required />
      </label>
      {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
      <button type="submit" className={styles.primary} disabled={isSaving}>
        {isSaving ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
