"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./admin.module.css";

const tabs = [
  { href: "/admin", label: "Intake & matching" },
  { href: "/admin/tutors", label: "Tutors" },
];

/** Notebook-style tabs across the top of the admin console. */
export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className={styles.tabs} aria-label="Admin sections">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={styles.tab}
          aria-current={pathname === tab.href ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
