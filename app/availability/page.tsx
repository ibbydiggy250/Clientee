/**
 * The old Hours tab. Weekly hours moved into the Profile tab as a calendar
 * on Nov 19, 2026, so old links land there.
 */
import { redirect } from "next/navigation";

export default function AvailabilityPage() {
  redirect("/profile#hours");
}
