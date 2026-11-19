/** One open conversation. Access is checked by lib/messaging.ts openThread. */
import Link from "next/link";

import paper from "@/components/paper/paper.module.css";
import { requireProfile } from "@/lib/auth/current-user";
import { MessagingError, openThread, type ThreadView } from "@/lib/messaging";

import { ThreadPane } from "../ThreadPane";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const { user } = await requireProfile();

  let thread: ThreadView;
  try {
    thread = await openThread(user, threadId, new Date());
  } catch (problem) {
    if (!(problem instanceof MessagingError)) throw problem;
    return (
      <div className={paper.fields}>
        <p className={paper.error}>{problem.message}</p>
        <Link className={paper.link} href="/messages">← All conversations</Link>
      </div>
    );
  }

  return <ThreadPane thread={thread} />;
}
