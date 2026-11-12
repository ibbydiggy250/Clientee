/** Partly hides an email for display: "maya@example.com" → "ma•••@example.com". */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}•••@${domain}`;
}
