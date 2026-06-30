"use client";

import { useState } from "react";
import Link from "next/link";
import { Background } from "@/components/background";
import { AppShell } from "@/components/app-shell";
import { Eyebrow } from "@/components/primitives";
import {
  IconArrowLeft,
  IconClipboard,
  IconMail,
  IconList,
  IconNotes,
  IconCompass,
  IconCheck,
  IconPlus,
  IconSpark,
} from "@/components/icons";
import {
  getSession,
  getStudent,
  sampleOutput,
  type AiOutput,
  type HomeworkItem,
} from "@/lib/mock-data";
import { cn, formatDate } from "@/lib/utils";

// --- Reusable output card ---------------------------------------------------

function OutputCard({
  icon: Icon,
  tone,
  index,
  title,
  hint,
  action,
  children,
}: {
  icon: typeof IconClipboard;
  tone: string;
  index: number;
  title: string;
  hint: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-start gap-4 border-b border-ink/8 p-6">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", tone)}>
          <Icon width={20} height={20} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-faint">0{index}</span>
            <h2 className="font-display text-xl text-ink">{title}</h2>
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">{hint}</p>
        </div>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}

const autosize =
  "w-full resize-none rounded-2xl border border-ink/10 bg-bone/40 p-4 text-ink leading-relaxed transition-colors focus:border-violet focus:bg-paper focus:outline-none focus:ring-4 focus:ring-violet/15";

export default function ReviewPage({
  params,
}: {
  params: { id: string };
}) {
  const session = getSession(params.id);
  const student = session ? getStudent(session.studentId) : undefined;
  const initial: AiOutput = session?.output ?? sampleOutput;

  const [output, setOutput] = useState<AiOutput>(initial);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  function update<K extends keyof AiOutput>(key: K, value: AiOutput[K]) {
    setOutput((o) => ({ ...o, [key]: value }));
    setSaved(false);
  }

  function updateHomework(i: number, patch: Partial<HomeworkItem>) {
    update(
      "homework",
      output.homework.map((h, idx) => (idx === i ? { ...h, ...patch } : h)),
    );
  }

  function addHomework() {
    update("homework", [...output.homework, { task: "", deadline: null }]);
  }

  function removeHomework(i: number) {
    update("homework", output.homework.filter((_, idx) => idx !== i));
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(output.parent_email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — no-op for the scaffold */
    }
  }

  const backHref = student ? `/students/${student.id}` : "/dashboard";

  return (
    <>
      <Background dim />
      <AppShell>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
        >
          <IconArrowLeft width={16} height={16} />
          Back to {student ? student.name : "dashboard"}
        </Link>

        {/* Header */}
        <header className="animate-rise-in mt-6 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <Eyebrow>Review &amp; edit</Eyebrow>
            <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
              Your follow-up package
            </h1>
            <p className="mt-3 text-lg text-ink-soft">
              {student ? `${student.name} · ` : ""}
              {session ? formatDate(session.sessionDate) : "New session"} · five
              drafts, all yours to tweak.
            </p>
          </div>
        </header>

        {/* Weak-topic strip (read-only context) */}
        <div className="mt-8 flex flex-wrap items-center gap-2 rounded-3xl border border-ink/10 bg-bone/50 px-5 py-4">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet">
            <IconSpark width={15} height={15} />
            Tagged weak topics
          </span>
          {output.weak_topics.map((t) => (
            <span
              key={t}
              className="rounded-full bg-violet-soft px-3 py-1 text-xs font-medium text-violet-deep"
            >
              {t}
            </span>
          ))}
          <span className="ml-auto text-xs text-ink-faint">
            Feeds forward into the next session&apos;s prep
          </span>
        </div>

        {/* The five editable outputs */}
        <div className="mt-8 grid gap-6">
          {/* 1 · Summary */}
          <OutputCard
            icon={IconClipboard}
            tone="bg-violet-soft text-violet-deep"
            index={1}
            title="Session summary"
            hint="A 2–4 sentence overview of what was covered"
          >
            <textarea
              rows={4}
              className={autosize}
              value={output.summary}
              onChange={(e) => update("summary", e.target.value)}
            />
          </OutputCard>

          {/* 2 · Parent email */}
          <OutputCard
            icon={IconMail}
            tone="bg-coral-soft text-coral"
            index={2}
            title="Parent / client email"
            hint="A warm, professional draft, ready to send"
            action={
              <button
                onClick={copyEmail}
                className={cn(
                  "btn text-xs",
                  copied
                    ? "bg-sage-soft text-sage"
                    : "border border-ink/15 bg-paper text-ink hover:border-ink/40",
                )}
              >
                {copied ? <IconCheck width={14} height={14} /> : <IconClipboard width={14} height={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            }
          >
            <textarea
              rows={9}
              className={autosize}
              value={output.parent_email}
              onChange={(e) => update("parent_email", e.target.value)}
            />
          </OutputCard>

          {/* 3 · Homework */}
          <OutputCard
            icon={IconList}
            tone="bg-amber/15 text-amber"
            index={3}
            title="Homework / action items"
            hint="Tasks with optional deadlines"
          >
            <div className="space-y-3">
              {output.homework.map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-bone/40 p-3 sm:flex-row sm:items-center"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber/20 text-xs font-bold text-amber">
                    {i + 1}
                  </span>
                  <input
                    className="flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1.5 text-ink focus:border-ink/15 focus:bg-paper focus:outline-none"
                    placeholder="Describe the task…"
                    value={item.task}
                    onChange={(e) => updateHomework(i, { task: e.target.value })}
                  />
                  <input
                    className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-1.5 text-sm text-ink-soft focus:border-violet focus:outline-none sm:w-44"
                    placeholder="Deadline (optional)"
                    value={item.deadline ?? ""}
                    onChange={(e) =>
                      updateHomework(i, { deadline: e.target.value || null })
                    }
                  />
                  <button
                    onClick={() => removeHomework(i)}
                    className="self-end rounded-lg px-2 py-1 text-sm text-ink-faint hover:bg-coral-soft hover:text-coral sm:self-auto"
                    aria-label="Remove task"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={addHomework}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink/25 px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-violet hover:text-violet"
              >
                <IconPlus width={15} height={15} />
                Add task
              </button>
            </div>
          </OutputCard>

          {/* 4 · Progress notes */}
          <OutputCard
            icon={IconNotes}
            tone="bg-sage-soft text-sage"
            index={4}
            title="Progress notes"
            hint="Tutor-facing notes on how the student is doing"
          >
            <textarea
              rows={5}
              className={autosize}
              value={output.progress_notes}
              onChange={(e) => update("progress_notes", e.target.value)}
            />
          </OutputCard>

          {/* 5 · Next-session prep */}
          <OutputCard
            icon={IconCompass}
            tone="bg-ink/8 text-ink"
            index={5}
            title="Next-session prep"
            hint="What to review or prepare before next time"
          >
            <textarea
              rows={4}
              className={autosize}
              value={output.next_session_prep}
              onChange={(e) => update("next_session_prep", e.target.value)}
            />
          </OutputCard>
        </div>

        {/* Sticky save bar */}
        <div className="sticky bottom-5 mt-8">
          <div className="card-sticker flex items-center justify-between gap-4 p-4 sm:px-6">
            <p className="text-sm text-ink-soft">
              {saved ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-sage">
                  <IconCheck width={16} height={16} />
                  Saved to this session
                </span>
              ) : (
                "Edits are stored separately from the AI's original draft."
              )}
            </p>
            <div className="flex items-center gap-2">
              <Link href={backHref} className="btn-ghost hidden sm:inline-flex">
                Done
              </Link>
              <button onClick={() => setSaved(true)} className="btn-accent">
                <IconCheck width={18} height={18} />
                Save session
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    </>
  );
}
