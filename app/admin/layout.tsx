/**
 * The admin console frame: TutorMe paper, a red ADMIN stamp and the tabs.
 * Non-admins who are signed in see a "staff only" note instead.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { PaperPage } from "@/components/paper/PaperPage";
import paper from "@/components/paper/paper.module.css";

import { SignOutButton } from "../home/SignOutButton";
import styles from "./admin.module.css";
import { AdminTabs } from "./AdminTabs";
import { getAdminActor } from "./guard";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdminActor();

  if (!admin) {
    return (
      <PaperPage action={<SignOutButton />}>
        <div className={`${paper.sheet} ${paper.narrow}`}>
          <p className={paper.note}>sorry —</p>
          <h1 className={`${paper.title} ${paper.titleSmall}`}>This door is for TutorMe staff.</h1>
          <p className={paper.muted}>You&apos;re signed in, but this login isn&apos;t an admin.</p>
          <Link className={paper.link} href="/home">
            Back to your home
          </Link>
        </div>
      </PaperPage>
    );
  }

  return (
    <PaperPage
      action={
        <div className={paper.row}>
          <span className={styles.stamp}>Admin</span>
          <SignOutButton />
        </div>
      }
    >
      <AdminTabs />
      {children}
    </PaperPage>
  );
}
