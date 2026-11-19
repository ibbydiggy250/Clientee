"use client";

/**
 * One open conversation: the notes, a live indicator, and the box to write in.
 * Messages come only from useThreadMessages (the live-update seam).
 */
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";

import styles from "@/components/messages/messages.module.css";
import paper from "@/components/paper/paper.module.css";
import { EASTERN } from "@/lib/eastern-time";
import type { ThreadView } from "@/lib/messaging";

import { sendMessageAction, type SendState } from "./actions";
import { useThreadMessages, type LiveStatus } from "./useThreadMessages";

const LIVE_LABELS: Record<LiveStatus, string> = { live: "Live", paused: "Paused", error: "Reconnecting" };

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function ThreadPane({ thread }: { thread: ThreadView }) {
  const { messages, status, refresh } = useThreadMessages(thread.id, thread.messages);
  const [sendState, formAction, isSending] = useActionState<SendState, FormData>(sendMessageAction, {});
  const listRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Keep the newest note in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  // After a successful send: clear the box and fetch right away.
  useEffect(() => {
    if (sendState.sentAt) {
      formRef.current?.reset();
      void refresh();
    }
  }, [sendState.sentAt, refresh]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    if (!String(fields.get("body") ?? "").trim()) return;
    startTransition(() => formAction(fields));
  }

  // Enter sends; Shift+Enter makes a new line.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <section className={styles.threadPane} aria-label={`Conversation: ${thread.title}`}>
      <header className={styles.threadHeader}>
        <div className={paper.field}>
          <Link className={`${paper.link} ${styles.backToList}`} href="/messages">← All conversations</Link>
          <h2 className={styles.threadHeading}>{thread.title}</h2>
          <span className={styles.threadSubtitle}>{thread.subtitle}</span>
        </div>
        <span className={styles.live} data-status={status} aria-live="polite">{LIVE_LABELS[status]}</span>
      </header>

      <div ref={listRef} className={styles.messageList}>
        {messages.length === 0 && <p className={styles.emptyThread}>say hello ✎</p>}
        {messages.map((message) => {
          const look = message.status === "held" ? styles.held : message.isMine ? styles.mine : styles.theirs;
          return (
            <article
              key={message.id}
              className={[
                styles.note,
                look,
                message.isMine ? styles.alignEnd : "",
                message.status === "rejected" ? styles.rejected : "",
              ].join(" ")}
            >
              {message.status === "held" && <span className={styles.heldStamp}>Held for review</span>}
              <span>{message.body}</span>
              <span className={styles.noteMeta}>
                {message.senderLabel} · {timeLabel(message.createdAt)}
                {message.status === "held" && message.flagReason && ` · contains a ${message.flagReason}`}
                {message.status === "rejected" && " · not delivered"}
              </span>
            </article>
          );
        })}
      </div>

      {thread.canPost ? (
        <form ref={formRef} onSubmit={handleSubmit} className={styles.composer}>
          <input type="hidden" name="threadId" value={thread.id} />
          <label className={paper.field}>
            <span className="sr-only">Write a message</span>
            <textarea className={styles.composerInput} name="body" placeholder="Write a note…" maxLength={4000} onKeyDown={handleKeyDown} />
          </label>
          {sendState.error && <p role="alert" className={paper.error}>{sendState.error}</p>}
          {sendState.status === "held" && !sendState.error && (
            <p className={paper.note}>that one&apos;s held for a quick check — it looked like contact details</p>
          )}
          <div className={styles.composerRow}>
            <span className={styles.composerHint}>No phone numbers, emails, handles or links — those get held for review.</span>
            <button type="submit" className={paper.primary} disabled={isSending}>
              {isSending ? "Passing…" : "Pass the note →"}
            </button>
          </div>
        </form>
      ) : (
        <p className={styles.composerHint}>
          {thread.readingAlong
            ? "You can read this conversation as the account holder, but only your learner and their tutor write here."
            : "This conversation is read-only for you."}
        </p>
      )}
    </section>
  );
}
