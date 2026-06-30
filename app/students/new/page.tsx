"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Background } from "@/components/background";
import { AppShell } from "@/components/app-shell";
import { Eyebrow } from "@/components/primitives";
import { IconArrowLeft, IconCheck } from "@/components/icons";

export default function NewStudentPage() {
  const router = useRouter();

  // Scaffold only — no persistence yet. Submitting returns to the dashboard.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/dashboard");
  }

  return (
    <>
      <Background dim />
      <AppShell>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
        >
          <IconArrowLeft width={16} height={16} />
          Back to students
        </Link>

        <div className="animate-rise-in mt-6 max-w-2xl">
          <Eyebrow>New student profile</Eyebrow>
          <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
            Who are we tutoring?
          </h1>
          <p className="mt-3 text-lg text-ink-soft">
            Just the basics. You can refine goals and details any time from their profile.
          </p>

          <form onSubmit={handleSubmit} className="card-sticker mt-10 space-y-6 p-7 sm:p-9">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="name">Student name</label>
                <input id="name" className="field" placeholder="Maya Rodriguez" required />
              </div>
              <div>
                <label className="label" htmlFor="subject">Subject</label>
                <input id="subject" className="field" placeholder="SAT Math" />
              </div>
              <div>
                <label className="label" htmlFor="grade">Grade level</label>
                <input id="grade" className="field" placeholder="11th grade" />
              </div>
              <div>
                <label className="label" htmlFor="parentEmail">Parent / client email</label>
                <input id="parentEmail" type="email" className="field" placeholder="family@example.com" />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="goals">Goals</label>
              <textarea
                id="goals"
                rows={3}
                className="field resize-none"
                placeholder="What are we working toward? e.g. reach a 1450+ composite and shore up algebra fundamentals."
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-ink/10 pt-6">
              <Link href="/dashboard" className="btn-ghost">Cancel</Link>
              <button type="submit" className="btn-accent">
                <IconCheck width={18} height={18} />
                Save student
              </button>
            </div>
          </form>
        </div>
      </AppShell>
    </>
  );
}
