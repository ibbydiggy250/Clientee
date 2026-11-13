/**
 * How a tutor's name is shown to families (mvp-spec.md, "Tutor profiles"):
 * first name and last initial. "Theo Tutor" → "Theo T.", "Ana" → "Ana".
 */
export function publicTutorName(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}
