"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";
import { IconLogout } from "@/components/icons";
import { cn } from "@/lib/utils";

// Top navigation chrome shared by all signed-in screens.
// Auth is mocked — the "sign out" link just returns to /login.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onDashboard = pathname === "/dashboard";

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-bone/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Brand href="/dashboard" />

          <nav className="flex items-center gap-1.5">
            <Link
              href="/dashboard"
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                onDashboard
                  ? "bg-ink text-bone"
                  : "text-ink-soft hover:bg-ink/5 hover:text-ink",
              )}
            >
              Students
            </Link>
            <div className="mx-1 hidden h-5 w-px bg-ink/10 sm:block" />
            <div className="hidden items-center gap-2.5 rounded-full border border-ink/10 bg-paper/70 py-1 pl-1 pr-3 sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-soft text-xs font-semibold text-violet-deep">
                JD
              </span>
              <span className="text-sm font-medium text-ink">Jordan Diaz</span>
            </div>
            <Link
              href="/login"
              title="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-coral-soft hover:text-coral"
            >
              <IconLogout width={18} height={18} />
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8">{children}</main>
    </div>
  );
}
