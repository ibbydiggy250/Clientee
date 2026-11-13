/**
 * Checks that every admin function refuses non-admins, even when called
 * directly (the way a Server Action can be). Nothing is written: each call is
 * expected to stop at the admin check, and the admin check itself only reads.
 *
 *   DATABASE_URL=<dev branch pooled url> npx tsx scripts/check-admin.ts
 */
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { profiles } from "../db/schema";
import {
  AdminError,
  getIntake,
  getRoster,
  inviteTutor,
  matchLearner,
  reissueTutorInvite,
  updateTutorTerm,
} from "../lib/admin";
import type { SignedInUser } from "../lib/auth/current-user";
import { db, orm } from "../lib/db";

let failures = 0;

function check(description: string, passed: boolean) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${description}`);
  if (!passed) failures += 1;
}

async function isRefused(task: () => Promise<unknown>): Promise<boolean> {
  try {
    await task();
    return false;
  } catch (problem) {
    return problem instanceof AdminError;
  }
}

async function main() {
  // A non-admin: a real family login if the branch has one, else a stranger.
  const [client] = await orm.select().from(profiles).where(eq(profiles.role, "client")).limit(1);
  const outsider: SignedInUser = client
    ? { id: client.id, email: client.email, name: client.name }
    : { id: randomUUID(), email: "nobody@example.com", name: "Nobody" };
  const anyId = randomUUID();

  console.log(`Non-admin used: ${client ? "a family login" : "a made-up user"}\n`);

  check("Non-admin can't read the intake queue", await isRefused(() => getIntake(outsider)));
  check("Non-admin can't read the tutor roster", await isRefused(() => getRoster(outsider)));
  check(
    "Non-admin can't match a learner",
    await isRefused(() =>
      matchLearner(outsider, { learnerId: anyId, tutorId: anyId, subject: "Math", tier: "standard", rateDollars: 60 }),
    ),
  );
  check(
    "Non-admin can't invite a tutor",
    await isRefused(() =>
      inviteTutor(outsider, { email: "x@example.com", subjects: [], termStart: "2026-01-01", termEnd: "2026-12-31" }),
    ),
  );
  check("Non-admin can't reissue a tutor invite", await isRefused(() => reissueTutorInvite(outsider, anyId, "x@example.com")));
  check(
    "Non-admin can't change a tutor's contract",
    await isRefused(() => updateTutorTerm(outsider, { tutorId: anyId, termEnd: "2027-01-01", status: "active" })),
  );

  const [admin] = await orm.select().from(profiles).where(eq(profiles.role, "admin")).limit(1);
  if (admin) {
    const roster = await getRoster({ id: admin.id, email: admin.email, name: admin.name }).catch(() => null);
    check("An admin can read the tutor roster", roster !== null);
  } else {
    console.log("SKIP  No admin on this branch, so the admin side wasn't checked.");
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.end());
