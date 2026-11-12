/**
 * Where to send someone after signing in, taken from `?next=`.
 *
 * Only a path on this site is allowed. "//evil.example" and "/\evil.example"
 * are rejected, because browsers treat both as a link to another site.
 */
export function safeNextPath(next: unknown, fallback = "/home"): string {
  if (typeof next !== "string") return fallback;
  const isSameSitePath = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\");
  return isSameSitePath ? next : fallback;
}
