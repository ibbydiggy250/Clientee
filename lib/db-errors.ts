/**
 * Recognising specific Postgres errors. Drizzle wraps the original error, so
 * these look at the error and everything in its `cause` chain.
 *
 * Codes used: 23505 unique rule broken, 23P01 exclusion rule broken
 * (e.g. a tutor double-booked), 23514 CHECK rule broken.
 */
export function hasPostgresCode(problem: unknown, code: string): boolean {
  for (let error = problem; error; error = (error as { cause?: unknown }).cause) {
    if ((error as { code?: string }).code === code) return true;
  }
  return false;
}
