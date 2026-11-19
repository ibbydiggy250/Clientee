/**
 * The contact filter (mvp-spec.md, "Messaging and anti-bypass"): messages that
 * look like they share a way to reach someone outside TutorMe are held for
 * admin review. Decided Nov 19, 2026: held, not just flagged.
 *
 * It errs on the side of holding. A false alarm only means admin clicks
 * "Deliver"; a miss means contact details reach the other side.
 * Pure function, no database, so it's easy to test (scripts/check-messaging.ts).
 */

type Rule = { reason: string; pattern: RegExp };

const RULES: Rule[] = [
  {
    reason: "email address",
    // name@site.com, and spelled-out forms like "name (at) site (dot) com"
    pattern: /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[a-z0-9-]+(?:\s*(?:\.|\(dot\)|\[dot\])\s*[a-z0-9-]+)+/i,
  },
  {
    reason: "phone number",
    // 7 or more digits in a row, allowing spaces, dots, dashes and brackets between them
    pattern: /(?:\+?\d[\s.\-()]*){7,}/,
  },
  {
    reason: "social handle",
    // @name at the start of a word
    pattern: /(?:^|\s)@[a-z0-9_.]{2,}/i,
  },
  {
    reason: "social app",
    // naming an outside app is a strong hint of moving the conversation
    pattern: /\b(?:insta(?:gram)?|snap(?:chat)?|tiktok|whats\s?app|telegram|discord|facebook|messenger|wechat|signal app|kik)\b/i,
  },
  {
    reason: "link",
    // web addresses, including bare ones like "mysite.com"
    // (but not the domain inside an email address, which the email rule reports)
    pattern: /\bhttps?:\/\/|\bwww\.|(?<![@.\w])[a-z0-9-]+\.(?:com|net|org|io|me|co|ly|gg|app)\b/i,
  },
];

export type FilterResult = {
  /** True if the message should be held for admin review. */
  hold: boolean;
  /** What was found, for admin: e.g. ["phone number", "link"]. */
  reasons: string[];
};

export function checkForContactInfo(body: string): FilterResult {
  const reasons = RULES.filter((rule) => rule.pattern.test(body)).map((rule) => rule.reason);
  return { hold: reasons.length > 0, reasons };
}
