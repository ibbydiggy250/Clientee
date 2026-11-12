import styles from "@/components/paper/paper.module.css";

import { signOutAction } from "./actions";

/** A plain form so signing out works even before JavaScript loads. */
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button type="submit" className={styles.link}>
        Sign out
      </button>
    </form>
  );
}
