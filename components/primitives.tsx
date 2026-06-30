import type { Student, SessionStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { IconCheck } from "@/components/icons";

// --- Avatar -----------------------------------------------------------------

const toneStyles: Record<Student["avatarTone"], string> = {
  violet: "bg-violet-soft text-violet-deep",
  coral: "bg-coral-soft text-coral",
  amber: "bg-amber/20 text-amber",
  sage: "bg-sage-soft text-sage",
};

export function Avatar({
  name,
  tone,
  size = "md",
}: {
  name: string;
  tone: Student["avatarTone"];
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  const sizes = {
    sm: "h-9 w-9 text-sm",
    md: "h-12 w-12 text-base",
    lg: "h-16 w-16 text-xl",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-2xl font-display font-semibold",
        toneStyles[tone],
        sizes[size],
      )}
    >
      {initials}
    </span>
  );
}

// --- Status badge -----------------------------------------------------------

const statusStyles: Record<
  SessionStatus,
  { label: string; className: string; dot: string }
> = {
  uploaded: { label: "Uploaded", className: "bg-ink/5 text-ink-soft", dot: "bg-ink-faint" },
  transcribing: { label: "Transcribing", className: "bg-amber/15 text-amber", dot: "bg-amber animate-pulse" },
  transcribed: { label: "Transcribed", className: "bg-amber/15 text-amber", dot: "bg-amber" },
  analyzing: { label: "Analyzing", className: "bg-violet-soft text-violet-deep", dot: "bg-violet animate-pulse" },
  ready: { label: "Ready", className: "bg-sage-soft text-sage", dot: "bg-sage" },
  error: { label: "Needs attention", className: "bg-coral-soft text-coral", dot: "bg-coral" },
};

export function StatusBadge({ status }: { status: SessionStatus }) {
  const s = statusStyles[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        s.className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

// --- Weak-topic chip --------------------------------------------------------

export function TopicChip({
  topic,
  count,
}: {
  topic: string;
  count?: number;
}) {
  return (
    <span className="chip">
      <span className="h-1.5 w-1.5 rounded-full bg-violet" />
      {topic}
      {count && count > 1 ? (
        <span className="ml-0.5 rounded-full bg-violet/10 px-1.5 text-[0.65rem] font-bold text-violet-deep">
          ×{count}
        </span>
      ) : null}
    </span>
  );
}

// --- Section eyebrow heading ------------------------------------------------

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="eyebrow">
      <span className="h-px w-6 bg-violet/50" />
      {children}
    </span>
  );
}

// --- Inline "done" pill -----------------------------------------------------

export function DonePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-sage">
      <IconCheck width={13} height={13} />
      {children}
    </span>
  );
}
