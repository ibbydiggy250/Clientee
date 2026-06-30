"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Background } from "@/components/background";
import { AppShell } from "@/components/app-shell";
import { Eyebrow } from "@/components/primitives";
import { IconCheck, IconSpark, IconArrowRight, IconWave } from "@/components/icons";
import { cn } from "@/lib/utils";

// Mirrors the status enum in the spec: uploaded -> transcribing ->
// transcribed -> analyzing -> ready. The scaffold fakes the timing so the
// flow is visible end-to-end without a backend.
const stages = [
  { key: "uploaded", label: "Recording received", detail: "Securely uploaded to storage" },
  { key: "transcribing", label: "Transcribing audio", detail: "Separating tutor and student speakers" },
  { key: "transcribed", label: "Transcript ready", detail: "Original recording discarded — text kept" },
  { key: "analyzing", label: "Analyzing with Claude", detail: "Drafting your five outputs in one pass" },
  { key: "ready", label: "Package ready", detail: "Five outputs waiting for your review" },
] as const;

export default function ProcessingPage({
  params,
}: {
  params: { id: string };
}) {
  const [step, setStep] = useState(0);
  const done = step >= stages.length - 1;

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setStep((s) => s + 1), 1600);
    return () => clearTimeout(t);
  }, [step, done]);

  return (
    <>
      <Background dim />
      <AppShell>
        <div className="animate-rise-in mx-auto max-w-2xl text-center">
          <Eyebrow>{done ? "All done" : "Working on it"}</Eyebrow>

          {/* Pulsing orb */}
          <div className="relative mx-auto mt-8 flex h-28 w-28 items-center justify-center">
            {!done && (
              <>
                <span className="absolute inset-0 rounded-full bg-violet/30 animate-pulse-ring" />
                <span className="absolute inset-0 rounded-full bg-violet/20 animate-pulse-ring [animation-delay:1.2s]" />
              </>
            )}
            <span
              className={cn(
                "relative flex h-20 w-20 items-center justify-center rounded-full text-bone shadow-soft transition-colors duration-500",
                done ? "bg-sage" : "bg-ink",
              )}
            >
              {done ? (
                <IconCheck width={34} height={34} />
              ) : (
                <IconSpark width={32} height={32} className="animate-spin [animation-duration:3s]" />
              )}
            </span>
          </div>

          <h1 className="mt-8 font-display text-4xl text-ink">
            {done ? "Your package is ready." : "Processing your session…"}
          </h1>
          <p className="mt-3 text-lg text-ink-soft">
            {done
              ? "Five drafted outputs are waiting for your review and edits."
              : "This usually takes a minute or two. Feel free to grab a coffee — we'll keep working."}
          </p>

          {/* Stage checklist */}
          <ol className="card-sticker mx-auto mt-10 space-y-1 p-4 text-left sm:p-6">
            {stages.map((stage, i) => {
              const state = i < step ? "done" : i === step ? "active" : "pending";
              return (
                <li
                  key={stage.key}
                  className={cn(
                    "flex items-center gap-4 rounded-2xl px-4 py-3 transition-colors",
                    state === "active" && "bg-violet-soft/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
                      state === "done" && "bg-sage text-paper",
                      state === "active" && "bg-violet text-paper",
                      state === "pending" && "bg-ink/8 text-ink-faint",
                    )}
                  >
                    {state === "done" ? (
                      <IconCheck width={18} height={18} />
                    ) : state === "active" ? (
                      <IconWave width={18} height={18} className="animate-pulse" />
                    ) : (
                      <span className="text-sm font-semibold">{i + 1}</span>
                    )}
                  </span>
                  <div>
                    <p
                      className={cn(
                        "font-medium",
                        state === "pending" ? "text-ink-faint" : "text-ink",
                      )}
                    >
                      {stage.label}
                    </p>
                    <p className="text-sm text-ink-faint">{stage.detail}</p>
                  </div>
                  {state === "active" && (
                    <span className="ml-auto text-xs font-semibold uppercase tracking-wider text-violet">
                      In progress
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mt-8">
            {done ? (
              <Link href={`/sessions/${params.id}/review`} className="btn-accent text-base">
                Review your outputs
                <IconArrowRight width={18} height={18} />
              </Link>
            ) : (
              <p className="text-sm text-ink-faint">
                You can safely leave this page — we&apos;ll have it ready when you&apos;re back.
              </p>
            )}
          </div>
        </div>
      </AppShell>
    </>
  );
}
