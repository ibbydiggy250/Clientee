/**
 * For someone who has a login but no TutorMe profile yet (their sign-up was
 * interrupted). Asks the sign-up questions again, without the login step.
 */
import { redirect } from "next/navigation";

import { PaperPage } from "@/components/paper/PaperPage";
import { findProfile, getSignedInUser } from "@/lib/auth/current-user";

import { SignOutButton } from "../../home/SignOutButton";
import { SignUpFlow } from "../SignUpFlow";

export const dynamic = "force-dynamic";

export default async function FinishSignUpPage() {
  const user = await getSignedInUser();
  if (!user) redirect("/sign-in");
  if (await findProfile(user.id)) redirect("/home");

  return (
    <PaperPage action={<SignOutButton />}>
      <SignUpFlow mode="finish" />
    </PaperPage>
  );
}
