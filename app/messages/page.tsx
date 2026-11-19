/** Messages with nothing open yet (wide screens show the list beside this). */
import paper from "@/components/paper/paper.module.css";

export default function MessagesHome() {
  return (
    <div className={paper.fields}>
      <p className={paper.note}>pick a conversation ←</p>
      <p className={paper.muted}>
        Everything stays inside TutorMe: messages with phone numbers, emails, social handles or links are held for a quick
        check before they&apos;re delivered.
      </p>
    </div>
  );
}
