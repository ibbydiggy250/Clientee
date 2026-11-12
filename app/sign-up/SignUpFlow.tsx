"use client";

/**
 * The sign-up screens, one step at a time:
 *
 *   1. "What best describes you?"  learner or parent (learners: 18 or older?)
 *   2. About the learner            learners only: grade, subjects, goals,
 *                                   and a parent's email for under-18s
 *   3. Your login                   name, email, password
 *
 * Every field lives in ONE form; steps are only shown or hidden, so answers
 * survive going back and forth. The server re-checks everything.
 *
 * mode "new"    — the normal path.
 * mode "finish" — already has a login, skips step 3.
 * mode "invite" — opened from an invite link, only step 3.
 */
import { startTransition, useActionState, useState, type FormEvent } from "react";

import { PenCircle, PenTick } from "@/components/paper/PaperPage";
import styles from "@/components/paper/paper.module.css";

import { finishSignUpAction, signUpAction, type SignUpState } from "./actions";

type Role = "learner" | "parent";
type Age = "adult" | "minor";
type Step = "role" | "about" | "login";

type Props = {
  mode: "new" | "finish" | "invite";
  inviteCode?: string;
};

const roleChoices: { role: Role; tab: string; title: string; line: string }[] = [
  { role: "learner", tab: "A", title: "I'm a learner", line: "I'm the one being tutored." },
  { role: "parent", tab: "B", title: "I'm a parent", line: "I'm signing up my child." },
];

export function SignUpFlow({ mode, inviteCode }: Props) {
  const action = mode === "finish" ? finishSignUpAction : signUpAction;
  const [state, formAction, isSaving] = useActionState<SignUpState, FormData>(action, {});

  const [role, setRole] = useState<Role | null>(null);
  const [age, setAge] = useState<Age | null>(null);
  const [step, setStep] = useState<Step>(mode === "invite" ? "login" : "role");

  // Which steps this person goes through, in order.
  const steps: Step[] =
    mode === "invite"
      ? ["login"]
      : [
          "role",
          ...(role === "learner" ? (["about"] as const) : []),
          ...(mode === "new" ? (["login"] as const) : []),
        ];
  const stepNumber = steps.indexOf(step) + 1;
  const isLastStep = stepNumber === steps.length;
  const roleStepDone = role === "parent" || (role === "learner" && age !== null);

  function pickRole(next: Role) {
    setRole(next);
    if (next === "parent") setAge(null);
  }

  // Submit by hand instead of <form action>, because React clears a form
  // after an action runs; this way a server error keeps every answer.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const answers = new FormData(event.currentTarget);
    startTransition(() => formAction(answers));
  }

  return (
    <form onSubmit={handleSubmit} className={styles.sheet}>
      {/* Answers from the clickable cards travel with the form */}
      <input type="hidden" name="role" value={role ?? ""} />
      <input type="hidden" name="age" value={age ?? ""} />
      {inviteCode && <input type="hidden" name="invite" value={inviteCode} />}

      {steps.length > 1 && (
        <p className={styles.note}>
          step {stepNumber} of {steps.length}
          {step === "role" && " — the easy one"}
        </p>
      )}

      {/* ---------- Step 1: who are you? ---------- */}
      <section hidden={step !== "role"} className={styles.fields}>
        <h1 className={styles.title}>
          What best describes{" "}
          <span className={styles.circled}>
            you?
            <PenCircle />
          </span>
        </h1>

        <div className={styles.cardGrid} role="radiogroup" aria-label="What best describes you?">
          {roleChoices.map((choice) => (
            <button
              key={choice.role}
              type="button"
              role="radio"
              aria-checked={role === choice.role}
              className={`${styles.card} ${styles.choice}`}
              onClick={() => pickRole(choice.role)}
            >
              <span className={styles.choiceTab}>{choice.tab}</span>
              <span className={styles.choiceTitle}>{choice.title}</span>
              <span className={styles.muted}>{choice.line}</span>
              {role === choice.role && <PenTick />}
            </button>
          ))}
        </div>

        {role === "learner" && (
          <div className={`${styles.field} ${styles.fadeIn}`}>
            <p className={styles.heading}>Are you 18 or older?</p>
            <div className={styles.answers} role="radiogroup" aria-label="Are you 18 or older?">
              <button type="button" role="radio" aria-checked={age === "adult"} className={styles.answer} onClick={() => setAge("adult")}>
                Yes
              </button>
              <button type="button" role="radio" aria-checked={age === "minor"} className={styles.answer} onClick={() => setAge("minor")}>
                Not yet
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ---------- Step 2: about the learner ---------- */}
      <section hidden={step !== "about"} className={styles.fields}>
        <h1 className={`${styles.title} ${styles.titleSmall}`}>Tell us about your learning.</h1>

        <label className={styles.field}>
          <span className={styles.label}>Grade or year</span>
          <input className={styles.input} name="grade" placeholder="e.g. 11th grade" autoComplete="off" />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Subjects</span>
          <input className={styles.input} name="subjects" placeholder="e.g. Chemistry, SAT Math" autoComplete="off" />
          <span className={styles.hint}>Separate them with commas.</span>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>What do you want to get out of tutoring?</span>
          <textarea className={styles.input} name="goals" placeholder="e.g. Get from a B to an A before finals" />
        </label>

        {age === "minor" && (
          <div className={`${styles.field} ${styles.fadeIn}`}>
            <p className={styles.note}>one more thing — a parent has to link up with you before you can book ↓</p>
            <label className={styles.field}>
              <span className={styles.label}>Your parent&apos;s email</span>
              <input className={styles.input} type="email" name="parentEmail" placeholder="parent@example.com" autoComplete="off" />
              <span className={styles.hint}>We&apos;ll give you a link to send them.</span>
            </label>
          </div>
        )}
      </section>

      {/* ---------- Step 3: the login ---------- */}
      {mode !== "finish" && (
        <section hidden={step !== "login"} className={styles.fields}>
          <h1 className={`${styles.title} ${styles.titleSmall}`}>
            {mode === "invite" ? "Make your login to accept the invite." : "Last bit: your login."}
          </h1>
          <label className={styles.field}>
            <span className={styles.label}>Your name</span>
            <input className={styles.input} name="name" autoComplete="name" required={step === "login"} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input className={styles.input} type="email" name="email" autoComplete="email" required={step === "login"} />
            {mode === "invite" && <span className={styles.hint}>Use the email the invite was sent to.</span>}
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input className={styles.input} type="password" name="password" autoComplete="new-password" minLength={8} required={step === "login"} />
            <span className={styles.hint}>At least 8 characters.</span>
          </label>
        </section>
      )}

      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}

      <div className={styles.row}>
        {stepNumber > 1 && (
          <button type="button" className={styles.secondary} onClick={() => setStep(steps[stepNumber - 2])}>
            ← Back
          </button>
        )}
        {isLastStep ? (
          <button type="submit" className={styles.primary} disabled={isSaving || (step === "role" && !roleStepDone)}>
            {isSaving ? "Saving…" : mode === "finish" ? "Finish sign-up" : "Create my account"}
          </button>
        ) : (
          <button
            type="button"
            className={styles.primary}
            disabled={step === "role" && !roleStepDone}
            onClick={() => setStep(steps[stepNumber])}
          >
            Continue →
          </button>
        )}
      </div>
    </form>
  );
}
