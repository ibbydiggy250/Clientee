/**
 * Messages: the conversation list beside whichever conversation is open.
 * Everyone signed in gets this page; what's listed depends on who they are.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "@/components/messages/messages.module.css";
import { PaperPage } from "@/components/paper/PaperPage";
import paper from "@/components/paper/paper.module.css";
import { requireProfile } from "@/lib/auth/current-user";
import { listThreads } from "@/lib/messaging";

import { SignOutButton } from "../home/SignOutButton";
import { ThreadList } from "./ThreadList";

export const dynamic = "force-dynamic";

export default async function MessagesLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await requireProfile();
  const threads = await listThreads(user);

  return (
    <PaperPage
      action={
        <div className={paper.row}>
          <Link className={paper.link} href={profile.role === "admin" ? "/admin/messages" : "/home"}>
            {profile.role === "admin" ? "Admin console" : "Home"}
          </Link>
          <SignOutButton />
        </div>
      }
    >
      <div className={styles.layout}>
        <aside className={styles.listPane}>
          <h1 className={styles.listTitle}>Messages</h1>
          <ThreadList threads={threads} />
        </aside>
        {children}
      </div>
    </PaperPage>
  );
}
