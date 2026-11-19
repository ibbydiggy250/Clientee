/** A person's TutorMe role, looked up fresh (as the database owner). */
import { eq } from "drizzle-orm";

import { profiles } from "@/db/schema";
import { orm } from "@/lib/db";

export type Role = (typeof profiles.$inferSelect)["role"];

export async function roleOf(profileId: string): Promise<Role | null> {
  const [profile] = await orm.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, profileId));
  return profile?.role ?? null;
}
