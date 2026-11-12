/**
 * Database connection for the app.
 *
 * Reads the Neon connection string from the environment (written to
 * .env.local by `neon deploy`) and shares one connection pool across
 * the whole app. Import `db` anywhere on the server to run queries:
 *
 *   import { db } from "@/lib/db";
 *   const { rows } = await db.query("select now()");
 *
 * Never import this file from browser code: the connection string is a secret.
 */
import { parseEnv } from "@neon/env";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../db/schema";
import neonConfig from "../neon";

// Validates that DATABASE_URL is set and gives it a typed name.
// DATABASE_URL is the pooled connection, which is the right one for app traffic.
// (Migrations should use DATABASE_URL_UNPOOLED instead.)
const { postgres } = parseEnv(neonConfig, ["DATABASE_URL"]);

export const db = new Pool({
  connectionString: postgres.databaseUrl,
});

// ---------------------------------------------------------------------------
// Typed queries with Drizzle, and running them as a signed-in user.
// ---------------------------------------------------------------------------

/**
 * Typed query builder on the same pool.
 *
 * Careful: `orm` (and `db`) run as the database OWNER, which skips row-level
 * security. Use them only for trusted server work that checks permissions
 * itself: sign-up, accepting invites, admin actions, webhooks, scheduled jobs.
 * For anything done on behalf of a signed-in user, use `withUser` instead.
 */
export const orm = drizzle(db, { schema });

/** The transaction handle `withUser` passes to your callback. */
export type UserTransaction = Parameters<
  Parameters<typeof orm.transaction>[0]
>[0];

/**
 * Runs `work` in a transaction where the database only shows and changes rows
 * this user is allowed to touch (see db/migrations/0001_row_level_security.sql).
 *
 *   const myLearners = await withUser(profileId, (tx) =>
 *     tx.select().from(schema.learners),
 *   );
 *
 * Both settings below are LOCAL, so they end with the transaction and never
 * leak to the next request that reuses this pooled connection.
 */
export async function withUser<T>(
  profileId: string,
  work: (tx: UserTransaction) => Promise<T>,
): Promise<T> {
  return orm.transaction(async (tx) => {
    await tx.execute(sql`set local role app_user`);
    await tx.execute(sql`select set_config('app.profile_id', ${profileId}, true)`);
    return work(tx);
  });
}
