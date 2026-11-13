"use server";

/**
 * Server Actions for hours, booking, cancelling, rescheduling and outcomes.
 * Each gets the signed-in user and passes it to lib code that checks permissions.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSignedInUser } from "@/lib/auth/current-user";
import { addHours, AvailabilityError, newWindowSchema, removeHours } from "@/lib/availability";
import { BookingError, bookSessions, cancelSession, recordOutcome, rescheduleSession } from "@/lib/booking";

export type SessionFormState = { error?: string; done?: boolean; message?: string };

async function signedInUser() {
  const user = await getSignedInUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** Turns known, fixable errors into a message on the form. */
async function attempt(task: () => Promise<SessionFormState | void>): Promise<SessionFormState> {
  try {
    const result = await task();
    revalidatePath("/home");
    revalidatePath("/availability");
    return result ?? { done: true };
  } catch (problem) {
    if (problem instanceof BookingError || problem instanceof AvailabilityError) return { error: problem.message };
    throw problem;
  }
}

// ---------- Weekly hours (tutors) ----------

export async function addHoursAction(_previous: SessionFormState, form: FormData): Promise<SessionFormState> {
  const user = await signedInUser();
  const input = newWindowSchema.safeParse({
    weekday: form.get("weekday"),
    startTime: form.get("startTime"),
    endTime: form.get("endTime"),
  });
  if (!input.success) return { error: input.error.issues[0].message };
  return attempt(() => addHours(user, input.data));
}

export async function removeHoursAction(form: FormData): Promise<void> {
  const user = await signedInUser();
  const windowId = z.uuid().safeParse(form.get("windowId"));
  if (!windowId.success) return;
  await removeHours(user, windowId.data);
  revalidatePath("/availability");
}

// ---------- Booking (families) ----------

const bookSchema = z.object({
  enrollmentId: z.uuid(),
  startsAt: z.iso.datetime("Pick a time first"),
  repeatWeekly: z.boolean(),
});

export async function bookAction(_previous: SessionFormState, form: FormData): Promise<SessionFormState> {
  const user = await signedInUser();
  const input = bookSchema.safeParse({
    enrollmentId: form.get("enrollmentId"),
    startsAt: form.get("startsAt"),
    repeatWeekly: form.get("repeatWeekly") === "yes",
  });
  if (!input.success) return { error: input.error.issues[0].message };

  let message = "";
  const result = await attempt(async () => {
    const booked = await bookSessions(
      user,
      { enrollmentId: input.data.enrollmentId, startsAt: new Date(input.data.startsAt), repeatWeekly: input.data.repeatWeekly },
      new Date(),
    );
    const count = booked.bookedDates.length;
    message = count === 1 ? "booked=1" : `booked=${count}&skipped=${booked.skippedDates.length}`;
  });
  if (result.error) return result;
  redirect(`/home?${message}`);
}

const rescheduleSchema = z.object({ sessionId: z.uuid(), startsAt: z.iso.datetime("Pick a new time first") });

export async function rescheduleAction(_previous: SessionFormState, form: FormData): Promise<SessionFormState> {
  const user = await signedInUser();
  const input = rescheduleSchema.safeParse({ sessionId: form.get("sessionId"), startsAt: form.get("startsAt") });
  if (!input.success) return { error: input.error.issues[0].message };

  const result = await attempt(() => rescheduleSession(user, input.data.sessionId, new Date(input.data.startsAt), new Date()));
  if (result.error) return result;
  redirect("/home?moved=1");
}

// ---------- Cancelling and outcomes ----------

export async function cancelAction(_previous: SessionFormState, form: FormData): Promise<SessionFormState> {
  const user = await signedInUser();
  const sessionId = z.uuid().safeParse(form.get("sessionId"));
  if (!sessionId.success) return { error: "Missing session." };
  return attempt(async () => {
    const { late } = await cancelSession(user, sessionId.data, new Date());
    return { done: true, message: late ? "Cancelled. This was under 24 hours' notice, so it will be charged." : "Cancelled." };
  });
}

export async function outcomeAction(_previous: SessionFormState, form: FormData): Promise<SessionFormState> {
  const user = await signedInUser();
  const input = z
    .object({ sessionId: z.uuid(), outcome: z.enum(["completed", "no_show"]) })
    .safeParse({ sessionId: form.get("sessionId"), outcome: form.get("outcome") });
  if (!input.success) return { error: "Pick what happened." };
  return attempt(() => recordOutcome(user, input.data.sessionId, input.data.outcome, new Date()));
}
