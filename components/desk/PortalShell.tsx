/**
 * The frame around every signed-in family and tutor page — the same desk
 * the admin console uses: paper, a rubber stamp naming the area, and tabs.
 *
 *   Family desk: Home · Sessions · Learners · Messages
 *   Clientee:    Today · Schedule · Learners · Earnings · Messages · Profile
 *                (weekly hours live on Profile since Nov 19, 2026)
 *
 * Admins who open a shared page (like Messages) get their console tabs.
 */
import type { ReactNode } from "react";

import { SignOutButton } from "@/app/home/SignOutButton";
import { PaperPage } from "@/components/paper/PaperPage";
import paper from "@/components/paper/paper.module.css";
import type { Profile, SignedInUser } from "@/lib/auth/current-user";
import { countUnread } from "@/lib/messaging";

import { DeskTabs, type DeskTab } from "./DeskTabs";
import styles from "./desk.module.css";

function tabsFor(role: Profile["role"], unread: number): DeskTab[] {
  if (role === "tutor") {
    return [
      { href: "/home", label: "Today" },
      { href: "/schedule", label: "Schedule" },
      { href: "/learners", label: "Learners" },
      { href: "/earnings", label: "Earnings" },
      { href: "/messages", label: "Messages", count: unread },
      { href: "/profile", label: "Profile", alsoOn: ["/availability"] },
    ];
  }
  if (role === "admin") {
    return [
      { href: "/admin", label: "Intake & matching" },
      { href: "/admin/tutors", label: "Tutors" },
      { href: "/admin/money", label: "Money" },
      { href: "/admin/messages", label: "Messages", alsoOn: ["/messages"] },
    ];
  }
  return [
    { href: "/home", label: "Home" },
    { href: "/sessions", label: "Sessions", alsoOn: ["/book"] },
    { href: "/learners", label: "Learners", alsoOn: ["/match"] },
    { href: "/messages", label: "Messages", count: unread },
  ];
}

const STAMPS: Record<Profile["role"], { label: string; className: string }> = {
  tutor: { label: "Clientee", className: styles.stampTutor },
  client: { label: "Family", className: styles.stampFamily },
  admin: { label: "Admin", className: "" },
};

export async function PortalShell({ user, profile, children }: { user: SignedInUser; profile: Profile; children: ReactNode }) {
  const unread = profile.role === "admin" ? 0 : await countUnread(user);
  const stamp = STAMPS[profile.role];

  return (
    <PaperPage
      action={
        <div className={paper.row}>
          <span className={`${styles.stamp} ${stamp.className}`}>{stamp.label}</span>
          <SignOutButton />
        </div>
      }
    >
      <DeskTabs tabs={tabsFor(profile.role, unread)} label={`${stamp.label} sections`} />
      {children}
    </PaperPage>
  );
}
