/**
 * A tutor's weekly hours: when families can book them.
 *
 * Unlike most writes, these go through `withUser`: row-level security lets a
 * working tutor edit only their own hours (migration 0001), and the database
 * refuses overlapping or backwards windows (migration 0007).
 * Times are Eastern clock times. Removing hours never cancels sessions that
 * are already booked.
 */
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { availability, tutors } from "@/db/schema";
import type { SignedInUser } from "@/lib/auth/current-user";
import { withUser, type UserTransaction } from "@/lib/db";
import { hasPostgresCode } from "@/lib/db-errors";

/** A problem the tutor can fix; its message is safe to show. */
export class AvailabilityError extends Error {}

export type HoursWindow = { id: string; weekday: number; startTime: string; endTime: string };

export const newWindowSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick an end time"),
  })
  .refine((window) => window.endTime > window.startTime, { message: "The end time has to be after the start time." });

async function myTutorId(tx: UserTransaction, userId: string): Promise<string | null> {
  const [tutor] = await tx.select({ id: tutors.id }).from(tutors).where(eq(tutors.profileId, userId));
  return tutor?.id ?? null;
}

export async function getMyHours(user: SignedInUser): Promise<HoursWindow[]> {
  return withUser(user.id, async (tx) => {
    const tutorId = await myTutorId(tx, user.id);
    if (!tutorId) return [];
    return tx
      .select({ id: availability.id, weekday: availability.weekday, startTime: availability.startTime, endTime: availability.endTime })
      .from(availability)
      .where(eq(availability.tutorId, tutorId))
      .orderBy(availability.weekday, availability.startTime);
  });
}

export async function addHours(user: SignedInUser, window: z.infer<typeof newWindowSchema>): Promise<void> {
  try {
    await withUser(user.id, async (tx) => {
      const tutorId = await myTutorId(tx, user.id);
      if (!tutorId) throw new AvailabilityError("Only tutors can set weekly hours.");
      await tx.insert(availability).values({ tutorId, ...window });
    });
  } catch (problem) {
    if (problem instanceof AvailabilityError) throw problem;
    if (hasPostgresCode(problem, "23P01")) throw new AvailabilityError("That overlaps hours you already have on that day.");
    if (hasPostgresCode(problem, "23514")) throw new AvailabilityError("The end time has to be after the start time.");
    // 42501: row-level security refused it (e.g. the contract has ended).
    if (hasPostgresCode(problem, "42501")) throw new AvailabilityError("Your hours can only be changed while your contract is active.");
    throw problem;
  }
}

export async function removeHours(user: SignedInUser, windowId: string): Promise<void> {
  await withUser(user.id, async (tx) => {
    const tutorId = await myTutorId(tx, user.id);
    if (!tutorId) throw new AvailabilityError("Only tutors can change weekly hours.");
    await tx.delete(availability).where(and(eq(availability.id, windowId), eq(availability.tutorId, tutorId)));
  });
}
