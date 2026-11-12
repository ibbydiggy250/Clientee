"use server";

import { redirect } from "next/navigation";

import { getSignedInUser } from "@/lib/auth/current-user";
import { acceptInvite, InviteError, invitePath } from "@/lib/invites";

export type AcceptState = { error?: string };

export async function acceptInviteAction(_previous: AcceptState, form: FormData): Promise<AcceptState> {
  const code = String(form.get("code") ?? "");
  const user = await getSignedInUser();
  if (!user) redirect(`/sign-in?next=${invitePath(code)}`);

  try {
    await acceptInvite(user, code);
  } catch (problem) {
    if (problem instanceof InviteError) return { error: problem.message };
    throw problem;
  }
  redirect("/home");
}
