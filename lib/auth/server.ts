/**
 * Neon Auth (Managed Better Auth) for the server side of the app.
 *
 * `auth` is used in Server Components, Server Actions, Route Handlers and the
 * proxy. Never import this file from browser code.
 */
import { createNeonAuth } from "@neon/auth/next/server";

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

if (!baseUrl || !cookieSecret) {
  throw new Error("NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET must be set in the env file");
}

export const auth = createNeonAuth({
  baseUrl,
  cookies: { secret: cookieSecret },
});
