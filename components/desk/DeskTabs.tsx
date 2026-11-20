"use client";

/**
 * Notebook tabs across the top of a desk. A tab is "current" on its own page
 * and on any page listed in `alsoOn` (e.g. booking pages count as Learners).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import styles from "./desk.module.css";

export type DeskTab = {
  href: string;
  label: string;
  /** Other path prefixes that belong to this tab. */
  alsoOn?: string[];
  /** A count to circle on the tab (e.g. unread messages). */
  count?: number;
};

function isCurrent(pathname: string, tab: DeskTab): boolean {
  const prefixes = [tab.href, ...(tab.alsoOn ?? [])];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function DeskTabs({ tabs, label }: { tabs: DeskTab[]; label: string }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // On phones the tab row scrolls sideways; bring the open tab into view.
  // Only the row scrolls (not the page), and only when the tab is hidden.
  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !current) return;
    const row = nav.getBoundingClientRect();
    const tab = current.getBoundingClientRect();
    const isHidden = tab.left < row.left || tab.right > row.right;
    // Shift the row so the open tab sits in the middle.
    if (isHidden) nav.scrollLeft += tab.left + tab.width / 2 - (row.left + row.width / 2);
  }, [pathname]);

  return (
    <nav ref={navRef} className={styles.tabs} aria-label={label}>
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={styles.tab} aria-current={isCurrent(pathname, tab) ? "page" : undefined}>
          {tab.label}
          {tab.count ? (
            <span className={styles.tabCount} aria-label={`${tab.count} unread`}>
              {tab.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
