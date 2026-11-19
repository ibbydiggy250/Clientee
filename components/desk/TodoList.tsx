/** "Needs you": a short to-do list with hand-drawn boxes. Each item has one action. */
import Link from "next/link";

import paper from "@/components/paper/paper.module.css";

import styles from "./desk.module.css";

export type TodoItem = { key: string; title: string; detail?: string; href: string; action: string };

export function TodoList({ items, allClearText }: { items: TodoItem[]; allClearText: string }) {
  if (items.length === 0) return <p className={styles.allClear}>{allClearText} ✓</p>;
  return (
    <ul className={styles.todo}>
      {items.map((item) => (
        <li key={item.key} className={styles.todoItem}>
          <span className={styles.todoBox} aria-hidden />
          <span className={styles.todoText}>
            <span className={styles.todoTitle}>{item.title}</span>
            {item.detail && <span className={styles.small}>{item.detail}</span>}
          </span>
          <Link className={paper.secondary} href={item.href}>{item.action}</Link>
        </li>
      ))}
    </ul>
  );
}
