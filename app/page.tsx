import Link from "next/link";
import { Background } from "@/components/background";
import { Brand } from "@/components/brand";
import { Eyebrow } from "@/components/primitives";
import {
  IconArrowRight,
  IconUpload,
  IconSpark,
  IconClipboard,
  IconMail,
  IconList,
  IconNotes,
  IconCompass,
} from "@/components/icons";

const outputs = [
  { icon: IconClipboard, label: "Session summary", tone: "text-violet-deep bg-violet-soft" },
  { icon: IconMail, label: "Parent email", tone: "text-coral bg-coral-soft" },
  { icon: IconList, label: "Homework list", tone: "text-amber bg-amber/15" },
  { icon: IconNotes, label: "Progress notes", tone: "text-sage bg-sage-soft" },
  { icon: IconCompass, label: "Next-session prep", tone: "text-ink bg-ink/8" },
];

const steps = [
  { n: "01", title: "Upload the recording", body: "Drop in the audio or video from your session. That's the whole input." },
  { n: "02", title: "Cadence does the admin", body: "Transcription with speaker separation, then one structured pass through Claude." },
  { n: "03", title: "Review, tweak, send", body: "Five polished, editable outputs — plus a history layer that compounds every week." },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen">
      <Background />

      {/* Top bar */}
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Brand />
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost hidden sm:inline-flex">
            Sign in
          </Link>
          <Link href="/login" className="btn-accent">
            Get started
            <IconArrowRight width={16} height={16} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-10 pt-12 sm:px-8 sm:pt-20">
        <div className="animate-rise-in max-w-3xl">
          <Eyebrow>Post-session workflow assistant</Eyebrow>
          <h1 className="mt-6 font-display text-5xl leading-[0.98] tracking-tight text-ink sm:text-7xl">
            The session ended.
            <br />
            The <span className="gradient-text italic">paperwork</span> already
            did too.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-soft text-pretty">
            Cadence turns one tutoring recording into a parent-ready email,
            a homework list, progress notes, and a prep brief for next time —
            in the few minutes it used to take you to open a blank doc.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/login" className="btn-accent text-base">
              Start your first session
              <IconArrowRight width={18} height={18} />
            </Link>
            <Link href="/dashboard" className="btn-ghost text-base">
              Peek at the demo
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink-faint">
            Built for independent tutors &amp; test-prep coaches. No card, no calendar sync, no fuss.
          </p>
        </div>

        {/* Floating output cluster */}
        <div className="relative mt-20 sm:mt-28">
          <div className="card-sticker relative overflow-hidden p-6 sm:p-10">
            <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
              {/* left: the one input */}
              <div>
                <span className="chip">
                  <IconUpload width={13} height={13} /> one input
                </span>
                <h2 className="mt-4 font-display text-2xl text-ink sm:text-3xl">
                  A single recording goes in.
                </h2>
                <div className="mt-6 flex items-center gap-4 rounded-3xl border border-dashed border-ink/25 bg-bone/60 p-5">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-bone">
                    <IconUpload width={22} height={22} />
                  </span>
                  <div>
                    <p className="font-medium text-ink">session-with-maya.m4a</p>
                    <p className="text-sm text-ink-faint">48:12 · waiting to be transformed</p>
                  </div>
                </div>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-violet">
                  <IconSpark width={16} height={16} className="animate-float" />
                  five outputs come back
                </div>
              </div>

              {/* right: the five outputs */}
              <div className="grid gap-3">
                {outputs.map((o, i) => (
                  <div
                    key={o.label}
                    className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-paper px-4 py-3 shadow-sm transition-transform hover:translate-x-1"
                    style={{ marginLeft: `${i * 8}px` }}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${o.tone}`}>
                      <o.icon width={18} height={18} />
                    </span>
                    <span className="font-medium text-ink">{o.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Eyebrow>How a session flows</Eyebrow>
        <h2 className="mt-5 max-w-2xl font-display text-4xl leading-tight text-ink sm:text-5xl">
          Three steps between the lesson and your evening back.
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="card group relative p-7 transition-transform hover:-translate-y-1">
              <span className="font-display text-5xl text-ink/15 transition-colors group-hover:text-violet/40">
                {s.n}
              </span>
              <h3 className="mt-4 font-display text-xl text-ink">{s.title}</h3>
              <p className="mt-2 text-ink-soft text-pretty">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-28 sm:px-8">
        <div className="card-sticker overflow-hidden bg-ink p-10 text-center sm:p-16">
          <h2 className="mx-auto max-w-2xl font-display text-4xl leading-tight text-bone sm:text-5xl">
            Every session makes the next one{" "}
            <span className="gradient-text italic">smarter</span>.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-bone/70">
            Weak topics and progress feed forward, so Cadence remembers what
            your student struggled with — even when you don&apos;t have time to.
          </p>
          <Link href="/login" className="btn-accent mt-9 text-base">
            Get started free
            <IconArrowRight width={18} height={18} />
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 pb-10 sm:px-8">
        <div className="flex flex-col items-center justify-between gap-3 border-t border-ink/10 pt-6 text-sm text-ink-faint sm:flex-row">
          <Brand />
          <p>UI scaffold · features wired up next.</p>
        </div>
      </footer>
    </div>
  );
}
