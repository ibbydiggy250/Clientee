"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Background } from "@/components/background";
import { Brand } from "@/components/brand";
import { IconArrowRight } from "@/components/icons";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");

  // No real auth yet — this just walks the flow into the dashboard.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/dashboard");
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <Background />

      {/* Left: editorial panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <Brand />
        <div className="max-w-md">
          <h1 className="font-display text-5xl leading-[1.02] text-ink">
            Your evenings,
            <br />
            <span className="gradient-text italic">handed back.</span>
          </h1>
          <p className="mt-6 text-lg text-ink-soft text-pretty">
            Cadence drafts the follow-up package while you pack up. Sign in to
            pick up where your last session left off.
          </p>
          <div className="mt-10 flex items-center gap-3">
            {["MR", "TK", "AN", "LP"].map((i, idx) => (
              <span
                key={i}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold ring-2 ring-bone",
                  ["bg-violet-soft text-violet-deep", "bg-coral-soft text-coral", "bg-amber/20 text-amber", "bg-sage-soft text-sage"][idx],
                )}
              >
                {i}
              </span>
            ))}
            <span className="text-sm text-ink-soft">4 students up to date this week</span>
          </div>
        </div>
        <p className="text-sm text-ink-faint">Post-session workflow assistant · MVP scaffold</p>
      </aside>

      {/* Right: form */}
      <div className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>

          {/* mode toggle */}
          <div className="mb-8 inline-flex rounded-full border border-ink/10 bg-paper/70 p-1">
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-semibold transition-colors",
                  mode === m ? "bg-ink text-bone" : "text-ink-soft hover:text-ink",
                )}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <h2 className="font-display text-3xl text-ink">
            {mode === "signin" ? "Welcome back." : "Let's get you set up."}
          </h2>
          <p className="mt-2 text-ink-soft">
            {mode === "signin"
              ? "Pick up your students right where you left them."
              : "One tutor account. Add students once you're in."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {mode === "signup" && (
              <div>
                <label className="label" htmlFor="name">Your name</label>
                <input id="name" className="field" placeholder="Jordan Diaz" />
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" className="field" placeholder="you@example.com" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" className="field" placeholder="••••••••" />
            </div>

            <button type="submit" className="btn-accent w-full text-base">
              {mode === "signin" ? "Sign in" : "Create account"}
              <IconArrowRight width={18} height={18} />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-faint">
            {mode === "signin" ? "New to Cadence? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-semibold text-violet hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>

          <p className="mt-8 text-center text-xs text-ink-faint">
            <Link href="/" className="hover:text-ink-soft">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
