/**
 * Where an invite link lands. Works signed out: it offers to sign in or make
 * a login, then brings the person back here to accept.
 */
import Link from "next/link";

import { PaperPage, PenCircle } from "@/components/paper/PaperPage";
import styles from "@/components/paper/paper.module.css";
import { getSignedInUser } from "@/lib/auth/current-user";
import { findInvite, invitePath, type InviteSummary } from "@/lib/invites";

import { SignOutButton } from "../../home/SignOutButton";
import { AcceptInviteForm } from "./AcceptInviteForm";

export const dynamic = "force-dynamic";

/**
 * The headline and button text for each kind of invite.
 * The headline is split so the red pen circles only its last word.
 */
function wording(invite: InviteSummary) {
  const learner = invite.learnerName ?? "a learner";
  const learnerFirstName = learner.split(" ")[0];
  switch (invite.kind) {
    case "parent":
      return {
        titleStart: "Link up with",
        titleCircled: `${learnerFirstName}.`,
        detail: `${learner} asked you to be their parent on TutorMe. Linking lets you book and pay for their sessions and see their progress and messages.`,
        consent: `By linking, you confirm you are ${learner}'s parent or guardian and consent to them using TutorMe.`,
        button: `Link to ${learner}`,
      };
    case "learner":
      return {
        titleStart: "Your own TutorMe",
        titleCircled: "login.",
        detail: `${invite.inviterName ?? "Your parent"} set up tutoring for you. Accept to get your own login, so you can see your sessions and message your tutor.`,
        consent: null,
        button: "Accept and continue",
      };
    default:
      return {
        titleStart: "Tutor",
        titleCircled: "invite.",
        detail: "Tutor invites open soon.",
        consent: null,
        button: "Accept",
      };
  }
}

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = await findInvite(code);
  const user = await getSignedInUser();

  if (!invite || invite.state !== "pending") {
    const message = !invite
      ? "This invite link isn't valid."
      : invite.state === "expired"
        ? "This invite has expired. Ask for a new link."
        : "This invite has already been used.";
    return (
      <PaperPage>
        <div className={`${styles.sheet} ${styles.narrow}`}>
          <p className={styles.note}>hmm —</p>
          <h1 className={`${styles.title} ${styles.titleSmall}`}>{message}</h1>
          <Link className={styles.link} href={user ? "/home" : "/sign-in"}>
            {user ? "Go to your home" : "Sign in"}
          </Link>
        </div>
      </PaperPage>
    );
  }

  const text = wording(invite);

  return (
    <PaperPage action={user ? <SignOutButton /> : undefined}>
      <div className={`${styles.sheet} ${styles.narrow}`}>
        <p className={styles.note}>you&apos;ve been invited</p>
        <h1 className={`${styles.title} ${styles.titleSmall}`}>
          {text.titleStart}{" "}
          <span className={styles.circled}>
            {text.titleCircled}
            <PenCircle />
          </span>
        </h1>
        <p>{text.detail}</p>
        <p className={styles.hint}>This invite is for {invite.maskedEmail}.</p>

        {user ? (
          <>
            {text.consent && <p className={styles.muted}>{text.consent}</p>}
            <AcceptInviteForm code={code} buttonLabel={text.button} />
          </>
        ) : (
          <div className={styles.row}>
            <Link className={styles.primary} href={`/sign-up?invite=${code}`}>
              Create my login
            </Link>
            <Link className={styles.link} href={`/sign-in?next=${invitePath(code)}`}>
              I already have one — sign in
            </Link>
          </div>
        )}
      </div>
    </PaperPage>
  );
}
