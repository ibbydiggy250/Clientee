"use client";

/**
 * The one place the Messages screen gets live messages from.
 *
 * TODAY (chosen Nov 19, 2026): polls GET /api/threads/<id>/messages every
 * POLL_EVERY_MS while the tab is visible, and right after sending.
 *
 * LATER, switching to Neon Realtime only changes this file plus a sealing
 * endpoint. The screens keep calling `useThreadMessages(threadId, initial)`:
 *   1. Server: `realtime.seal({ query: threadMessagesQuery(viewer, threadId) })`
 *      from lib/messaging.ts, returned by a Route Handler after the same
 *      access check pollThread() does. (Turn RLS off on `messages` in that
 *      migration; the query already authorizes in its own SQL.)
 *   2. Here: replace the polling effect with
 *      `useLiveQuery(sealed, { refreshQuery })` from @neon/realtime-react,
 *      mapping rows to MessageView the way lib/messaging.ts loadMessages does.
 *   3. After sending, `await utils.awaitTxId(result.txid, 10_000)` — sendMessage
 *      already returns the txid.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { MessageView } from "@/lib/messaging";

const POLL_EVERY_MS = 5000;

export type LiveStatus = "live" | "paused" | "error";

export function useThreadMessages(threadId: string, initialMessages: MessageView[]) {
  const [messages, setMessages] = useState<MessageView[]>(initialMessages);
  const [status, setStatus] = useState<LiveStatus>("live");
  const inFlight = useRef(false);

  // Start over when switching to another thread.
  useEffect(() => {
    setMessages(initialMessages);
  }, [threadId, initialMessages]);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const response = await fetch(`/api/threads/${threadId}/messages`, { cache: "no-store" });
      if (!response.ok) {
        setStatus("error");
        return;
      }
      const body = (await response.json()) as { messages: MessageView[] };
      setMessages(body.messages);
      setStatus("live");
    } catch {
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }, [threadId]);

  useEffect(() => {
    // Poll only while the page is visible, so background tabs stay quiet.
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (timer) return;
      timer = setInterval(refresh, POLL_EVERY_MS);
      setStatus("live");
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
      setStatus("paused");
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  return { messages, status, refresh };
}
