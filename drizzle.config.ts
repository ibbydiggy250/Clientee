/**
 * Drizzle Kit settings for generating and running migrations.
 *
 * Migrations use DATABASE_URL_UNPOOLED (a direct connection), not the pooled
 * DATABASE_URL the app uses, because schema changes need a session-level
 * connection.
 */
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });

const migrationUrl = process.env.DATABASE_URL_UNPOOLED;
if (!migrationUrl) {
  throw new Error("DATABASE_URL_UNPOOLED is missing from .env.local");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: { url: migrationUrl },
  // Only manage our own tables; Neon Auth owns the neon_auth schema.
  schemaFilter: ["public"],
});
