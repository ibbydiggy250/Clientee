import Link from "next/link";
import { cn } from "@/lib/utils";

// Wordmark for the product. "Cadence" is a working name for the scaffold —
// rename freely; it lives only here.
export function Brand({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5", className)}
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-ink text-bone shadow-sticker-sm transition-transform duration-200 group-hover:-rotate-6">
        {/* waveform glyph */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 12h3l2-6 4 13 3-10 2 3h4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-coral ring-2 ring-bone" />
      </span>
      <span className="font-display text-xl font-semibold tracking-tight text-ink">
        Cadence
      </span>
    </Link>
  );
}
