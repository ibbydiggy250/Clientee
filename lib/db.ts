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
import { Pool } from "pg";

import neonConfig from "../neon";

// Validates that DATABASE_URL is set and gives it a typed name.
// DATABASE_URL is the pooled connection, which is the right one for app traffic.
// (Migrations should use DATABASE_URL_UNPOOLED instead.)
const { postgres } = parseEnv(neonConfig, ["DATABASE_URL"]);

export const db = new Pool({
  connectionString: postgres.databaseUrl,
});
