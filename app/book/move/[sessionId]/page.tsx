/** Move a booked session to another open time (24+ hours ahead only). */
import { PortalShell } from "@/components/desk/PortalShell";
import { PenCircle } from "@/components/paper/PaperPage";
import paper from "@/components/paper/paper.module.css";
import { requireProfile } from "@/lib/auth/current-user";
import { BookingError, getRescheduleSlots, type Slot } from "@/lib/booking";

import { SlotPlanner } from "../../SlotPlanner";

export const dynamic = "force-dynamic";

export default async function MoveSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { user, profile } = await requireProfile();

  let slots: Slot[] = [];
  let problemMessage: string | null = null;
  try {
    slots = await getRescheduleSlots(user, sessionId, new Date());
  } catch (problem) {
    if (!(problem instanceof BookingError)) throw problem;
    problemMessage = problem.message;
  }

  return (
    <PortalShell user={user} profile={profile}>
      <div className={paper.sheet}>
        <p className={paper.note}>moving a session</p>
        <h1 className={`${paper.title} ${paper.titleSmall}`}>
          Pick a new{" "}
          <span className={paper.circled}>
            time.
            <PenCircle />
          </span>
        </h1>
        {problemMessage ? (
          <p className={paper.error}>{problemMessage}</p>
        ) : (
          <SlotPlanner
            mode="move"
            sessionId={sessionId}
            slots={slots.map((slot) => ({ date: slot.date, clock: slot.clock, startsAt: slot.startsAt.toISOString() }))}
          />
        )}
      </div>
    </PortalShell>
  );
}
