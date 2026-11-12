"use client";

import { useActionState } from "react";

import styles from "@/components/paper/paper.module.css";

import { acceptInviteAction, type AcceptState } from "./actions";

export function AcceptInviteForm({ code, buttonLabel }: { code: string; buttonLabel: string }) {
  const [state, formAction, isSaving] = useActionState<AcceptState, FormData>(acceptInviteAction, {});

  return (
    <form action={formAction} className={styles.fields}>
      <input type="hidden" name="code" value={code} />
      {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
      <button type="submit" className={styles.primary} disabled={isSaving}>
        {isSaving ? "Linking…" : buttonLabel}
      </button>
    </form>
  );
}
