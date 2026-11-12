/**
 * Runs before every page: signed-out visitors to a private page are sent to
 * /sign-in, and sessions are refreshed when needed.
 *
 * This is NOT the permission check. Every Server Action and data read checks
 * the session itself (see lib/auth/current-user.ts) and the database enforces
 * row-level security on top.
 */
import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/sign-in",
  publicRoutes: [
    "/",
    "/sign-in",
    "/sign-up", // also covers /sign-up/finish, which checks the session itself
    "/invite", // /invite/<code> must work before the person has an account
    "/verify", // entering the email code happens before there is a session
  ],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
