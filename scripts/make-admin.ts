/**
 * Promotes an existing TutorMe login to admin.
 *
 *   npx tsx scripts/make-admin.ts --branch dev-foundation --email you@example.com
 *
 * The person must have signed up first. The Neon branch is REQUIRED and is
 * printed before anything changes, so production is never touched by accident.
 * The connection string is fetched from the Neon CLI and never printed.
 */
import { execFileSync } from "node:child_process";

import { Client } from "pg";

const PROJECT_ID = "rough-king-01689586";

function readArgument(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`Missing --${name}. Usage: npx tsx scripts/make-admin.ts --branch <neon branch> --email <email>`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const branch = readArgument("branch");
  const email = readArgument("email").trim().toLowerCase();

  console.log(`Neon branch: ${branch}`);
  console.log(`Promoting:   ${email}`);

  const connectionString = execFileSync(
    "neon",
    ["connection-string", branch, "--project-id", PROJECT_ID],
    { encoding: "utf8", shell: process.platform === "win32" },
  ).trim();

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query(
      "update profiles set role = 'admin' where email = $1 returning name, role",
      [email],
    );
    if (rows.length === 0) {
      console.error("No TutorMe profile has that email. Sign up first (and finish verification), then run this again.");
      process.exitCode = 1;
    } else {
      console.log(`Done: ${rows[0].name} is now ${rows[0].role}.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
