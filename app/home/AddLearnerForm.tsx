"use client";

/** Lets an account holder add a learner to their account. */
import { useActionState, useEffect, useRef, useState } from "react";

import styles from "@/components/paper/paper.module.css";

import { addLearnerAction, type FormState } from "./actions";

export function AddLearnerForm() {
  const [state, formAction, isSaving] = useActionState<FormState, FormData>(addLearnerAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [isMinor, setIsMinor] = useState(true);

  // Clear the form after a learner is added.
  useEffect(() => {
    if (state.done) {
      formRef.current?.reset();
      setIsMinor(true);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className={`${styles.card} ${styles.formCard} ${styles.fields}`}>
      <label className={styles.field}>
        <span className={styles.label}>Learner&apos;s name</span>
        <input className={styles.input} name="name" required autoComplete="off" />
      </label>
      <fieldset className={styles.field}>
        <legend className={styles.label}>Are they under 18?</legend>
        <div className={styles.answers}>
          <label className={styles.answer}>
            <input type="radio" name="isMinor" value="yes" defaultChecked onChange={() => setIsMinor(true)} /> Yes
          </label>
          <label className={styles.answer}>
            <input type="radio" name="isMinor" value="no" onChange={() => setIsMinor(false)} /> No, 18 or older
          </label>
        </div>
      </fieldset>
      {isMinor && (
        <label className={`${styles.consent} ${styles.fadeIn}`}>
          <input type="checkbox" name="guardianConsent" value="yes" required />
          <span>I&apos;m this learner&apos;s parent or guardian, and I consent to them using TutorMe.</span>
        </label>
      )}
      <label className={styles.field}>
        <span className={styles.label}>Grade or year</span>
        <input className={styles.input} name="grade" placeholder="e.g. 8th grade" autoComplete="off" />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Subjects</span>
        <input className={styles.input} name="subjects" placeholder="e.g. Algebra, Spanish" autoComplete="off" />
        <span className={styles.hint}>Separate them with commas.</span>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Goals</span>
        <textarea className={styles.input} name="goals" placeholder="What should tutoring help with?" />
      </label>
      {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
      <button type="submit" className={styles.primary} disabled={isSaving}>
        {isSaving ? "Adding…" : "Add learner"}
      </button>
    </form>
  );
}
