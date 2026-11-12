/**
 * Checks that row-level security does what mvp-spec.md says.
 *
 * It creates a small fake world (two families, three tutors, an admin) inside
 * ONE transaction, checks what each person can see and do, then ROLLS BACK,
 * so nothing is ever saved. Still, point it at a dev branch, not production.
 *
 *   DATABASE_URL_UNPOOLED=<dev branch url> npx tsx scripts/check-rls.ts
 */
import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local", quiet: true });

const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });

let failures = 0;

function check(description: string, passed: boolean) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${description}`);
  if (!passed) failures += 1;
}

/** Runs `work` as a given person (or as nobody), then undoes any changes. */
async function asPerson<T>(profileId: string | null, work: () => Promise<T>) {
  await client.query("savepoint person");
  try {
    await client.query("set local role app_user");
    await client.query("select set_config('app.profile_id', $1, true)", [profileId ?? ""]);
    return await work();
  } finally {
    await client.query("rollback to savepoint person");
  }
}

/** True if running `statement` is refused by the database. */
async function isRefused(profileId: string, statement: string, params: unknown[] = []) {
  return asPerson(profileId, async () => {
    try {
      await client.query(statement, params);
      return false;
    } catch {
      return true;
    }
  });
}

async function countVisible(profileId: string | null, table: string) {
  return asPerson(profileId, async () => {
    const { rows } = await client.query(`select count(*)::int as n from ${table}`);
    return rows[0].n as number;
  });
}

// ---------------------------------------------------------------------------
// The fake world
// ---------------------------------------------------------------------------

const people = {
  admin: randomUUID(),
  parentA: randomUUID(),
  parentB: randomUUID(),
  tutorActive: randomUUID(), // teaches learner A
  tutorUnmatched: randomUUID(), // active, but not matched with anyone
  tutorInactive: randomUUID(), // used to teach learner A, contract ended
};

const ids = {
  accountA: randomUUID(),
  accountB: randomUUID(),
  learnerA: randomUUID(), // a minor, belongs to parent A
  learnerB: randomUUID(), // belongs to parent B
  tutorActive: randomUUID(),
  tutorUnmatched: randomUUID(),
  tutorInactive: randomUUID(),
  thread: randomUUID(),
};

async function buildWorld() {
  const profileRows: [string, string, string][] = [
    [people.admin, "admin", "Admin"],
    [people.parentA, "client", "Parent A"],
    [people.parentB, "client", "Parent B"],
    [people.tutorActive, "tutor", "Tutor Active"],
    [people.tutorUnmatched, "tutor", "Tutor Unmatched"],
    [people.tutorInactive, "tutor", "Tutor Inactive"],
  ];
  for (const [id, role, name] of profileRows) {
    await client.query(
      "insert into profiles (id, role, name, email) values ($1, $2, $3, $4)",
      [id, role, name, `${id}@example.test`],
    );
  }

  await client.query(
    "insert into accounts (id, owner_id) values ($1, $2), ($3, $4)",
    [ids.accountA, people.parentA, ids.accountB, people.parentB],
  );
  await client.query(
    `insert into learners (id, account_id, name, is_minor) values
       ($1, $2, 'Learner A', true), ($3, $4, 'Learner B', false)`,
    [ids.learnerA, ids.accountA, ids.learnerB, ids.accountB],
  );
  await client.query(
    `insert into tutors (id, profile_id, status) values
       ($1, $2, 'active'), ($3, $4, 'active'), ($5, $6, 'inactive')`,
    [
      ids.tutorActive, people.tutorActive,
      ids.tutorUnmatched, people.tutorUnmatched,
      ids.tutorInactive, people.tutorInactive,
    ],
  );
  await client.query(
    `insert into enrollments (learner_id, tutor_id, subject, rate_cents) values
       ($1, $2, 'Math', 6000), ($1, $3, 'Physics', 6000)`,
    [ids.learnerA, ids.tutorActive, ids.tutorInactive],
  );
  // Learner A has no login, so the tutor is the only participant;
  // parent A can still read it because learner A is a minor.
  await client.query(
    "insert into threads (id, learner_id, participant_ids) values ($1, $2, $3)",
    [ids.thread, ids.learnerA, [people.tutorActive]],
  );
  await client.query(
    "insert into messages (thread_id, sender_id, body) values ($1, $2, 'See you Tuesday')",
    [ids.thread, people.tutorActive],
  );
}

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

async function runChecks() {
  console.log("\nLearners");
  check("Parent A sees only their own learner", (await countVisible(people.parentA, "learners")) === 1);
  check("Parent B sees only their own learner", (await countVisible(people.parentB, "learners")) === 1);
  check("Matched tutor sees their one learner", (await countVisible(people.tutorActive, "learners")) === 1);
  check("Unmatched tutor sees no learners", (await countVisible(people.tutorUnmatched, "learners")) === 0);
  check("Inactive tutor sees no learners", (await countVisible(people.tutorInactive, "learners")) === 0);
  check("Admin sees every learner", (await countVisible(people.admin, "learners")) === 2);
  check("Nobody signed in sees nothing", (await countVisible(null, "learners")) === 0);

  console.log("\nContact info");
  check(
    "A tutor cannot read anyone's email",
    await isRefused(people.tutorActive, "select email from profiles"),
  );
  check(
    "Parent A can see their tutor's name",
    await asPerson(people.parentA, async () => {
      const { rows } = await client.query("select name from profiles where id = $1", [people.tutorActive]);
      return rows.length === 1;
    }),
  );
  check(
    "Parent B cannot see a tutor they are not matched with",
    await asPerson(people.parentB, async () => {
      const { rows } = await client.query("select name from profiles where id = $1", [people.tutorActive]);
      return rows.length === 0;
    }),
  );

  console.log("\nMessages");
  check("Parent A can read their minor's thread", (await countVisible(people.parentA, "messages")) === 1);
  check("Parent B cannot read it", (await countVisible(people.parentB, "messages")) === 0);
  check(
    "Parent A cannot post in their minor's thread with the tutor",
    await isRefused(
      people.parentA,
      "insert into messages (thread_id, sender_id, body) values ($1, $2, 'hi')",
      [ids.thread, people.parentA],
    ),
  );
  check(
    "The tutor can post in their own thread",
    !(await isRefused(
      people.tutorActive,
      "insert into messages (thread_id, sender_id, body) values ($1, $2, 'hi')",
      [ids.thread, people.tutorActive],
    )),
  );
  check(
    "Nobody can send a message as someone else",
    await isRefused(
      people.tutorActive,
      "insert into messages (thread_id, sender_id, body) values ($1, $2, 'hi')",
      [ids.thread, people.parentA],
    ),
  );

  console.log("\nNo self-promotion or self-linking");
  check(
    "A user cannot make themselves admin",
    await isRefused(people.parentA, "update profiles set role = 'admin' where id = $1", [people.parentA]),
  );
  check(
    "A parent cannot attach someone's login to a learner",
    await isRefused(
      people.parentA,
      "insert into learners (account_id, profile_id, name, is_minor) values ($1, $2, 'X', true)",
      [ids.accountA, people.parentB],
    ),
  );
  check(
    "A parent cannot add a learner to someone else's account",
    await isRefused(
      people.parentA,
      "insert into learners (account_id, name, is_minor) values ($1, 'X', true)",
      [ids.accountB],
    ),
  );
  check(
    "A parent can add a learner to their own account",
    !(await isRefused(
      people.parentA,
      "insert into learners (account_id, name, is_minor) values ($1, 'New kid', true)",
      [ids.accountA],
    )),
  );
}

async function main() {
  await client.connect();
  await client.query("begin");
  try {
    await buildWorld();
    await runChecks();
  } finally {
    await client.query("rollback"); // nothing from this script is ever saved
    await client.end();
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
