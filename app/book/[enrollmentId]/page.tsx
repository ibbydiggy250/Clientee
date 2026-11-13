/** Book a session with a matched tutor. Only the learner's family can open it. */
import Link from "next/link";

import { PaperPage, PenCircle } from "@/components/paper/PaperPage";
import paper from "@/components/paper/paper.module.css";
import { requireProfile } from "@/lib/auth/current-user";
import { BookingError, getBookingPage, type BookingPage } from "@/lib/booking";

import { dollars } from "../../admin/guard";
import { SignOutButton } from "../../home/SignOutButton";
import { SlotPlanner } from "../SlotPlanner";

export const dynamic = "force-dynamic";

export default async function BookPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = await params;
  const { user } = await requireProfile();

  let page: BookingPage;
  try {
    page = await getBookingPage(user, enrollmentId, new Date());
  } catch (problem) {
    if (!(problem instanceof BookingError)) throw problem;
    return (
      <PaperPage action={<SignOutButton />}>
        <div className={`${paper.sheet} ${paper.narrow}`}>
          <p className={paper.note}>hmm —</p>
          <h1 className={`${paper.title} ${paper.titleSmall}`}>{problem.message}</h1>
          <Link className={paper.link} href="/home">← Back home</Link>
        </div>
      </PaperPage>
    );
  }

  return (
    <PaperPage action={<SignOutButton />}>
      <div className={paper.sheet}>
        <p className={paper.note}>
          {page.subject.toLowerCase()} · {page.learnerName.split(" ")[0].toLowerCase()} with {page.tutorName.split(" ")[0].toLowerCase()}
        </p>
        <h1 className={`${paper.title} ${paper.titleSmall}`}>
          Pick a{" "}
          <span className={paper.circled}>
            time.
            <PenCircle />
          </span>
        </h1>
        {page.closedReason ? (
          <p className={paper.error}>{page.closedReason}</p>
        ) : (
          <SlotPlanner
            mode="book"
            enrollmentId={enrollmentId}
            priceLabel={`${dollars(page.rateCents)}`}
            slots={page.slots.map((slot) => ({ date: slot.date, clock: slot.clock, startsAt: slot.startsAt.toISOString() }))}
          />
        )}
        <Link className={paper.link} href="/home">← Back home</Link>
      </div>
    </PaperPage>
  );
}
