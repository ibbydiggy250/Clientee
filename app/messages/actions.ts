"use server";

/** Server Actions for messaging. Each passes the signed-in user to lib/messaging.ts. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSignedInUser } from "@/lib/auth/current-user";
import { MAX_MESSAGE_LENGTH, MessagingError, reviewHeldMessage, sendMessage } from "@/lib/messaging";

export type SendState = { error?: string; status?: "delivered" | "held"; sentAt?: number };

async function signedInUser() {
  const user = await getSignedInUser();
  if (!user) redirect("/sign-in");
  return user;
}

const sendSchema = z.object({
  threadId: z.uuid(),
  body: z.string().max(MAX_MESSAGE_LENGTH, `Keep messages under ${MAX_MESSAGE_LENGTH} characters.`),
});

export async function sendMessageAction(_previous: SendState, form: FormData): Promise<SendState> {
  const user = await signedInUser();
  const input = sendSchema.safeParse({ threadId: form.get("threadId"), body: form.get("body") ?? "" });
  if (!input.success) return { error: input.error.issues[0].message };

  try {
    const result = await sendMessage(user, input.data.threadId, input.data.body, new Date());
    revalidatePath("/messages");
    return { status: result.status, sentAt: Date.now() };
  } catch (problem) {
    if (problem instanceof MessagingError) return { error: problem.message };
    throw problem;
  }
}

export type ReviewState = { error?: string; done?: "deliver" | "reject" };

export async function reviewHeldAction(_previous: ReviewState, form: FormData): Promise<ReviewState> {
  const user = await signedInUser();
  const input = z
    .object({ messageId: z.uuid(), decision: z.enum(["deliver", "reject"]) })
    .safeParse({ messageId: form.get("messageId"), decision: form.get("decision") });
  if (!input.success) return { error: "Pick deliver or reject." };

  try {
    await reviewHeldMessage(user, input.data.messageId, input.data.decision, new Date());
    revalidatePath("/admin/messages");
    return { done: input.data.decision };
  } catch (problem) {
    if (problem instanceof MessagingError) return { error: problem.message };
    throw problem;
  }
}
