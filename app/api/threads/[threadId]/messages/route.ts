/**
 * GET /api/threads/<id>/messages — the latest messages in one thread, for the
 * live-update poll (app/messages/useThreadMessages.ts).
 *
 * A Route Handler rather than a Server Action on purpose: Next.js runs Server
 * Actions one at a time, so a poll every few seconds would queue behind (and
 * delay) sending. Access is re-checked on every call, so someone removed from
 * a thread stops receiving it on the next poll.
 */
import { getSignedInUser } from "@/lib/auth/current-user";
import { MessagingError, pollThread } from "@/lib/messaging";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  const user = await getSignedInUser();
  if (!user) return Response.json({ error: "Signed out" }, { status: 401 });

  const { threadId } = await params;
  try {
    const messages = await pollThread(user, threadId, new Date());
    return Response.json({ messages });
  } catch (problem) {
    if (problem instanceof MessagingError) return Response.json({ error: problem.message }, { status: 403 });
    throw problem;
  }
}
