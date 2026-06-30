import Link from "next/link";
import { notFound } from "next/navigation";
import { Background } from "@/components/background";
import { AppShell } from "@/components/app-shell";
import { Avatar, StatusBadge, Eyebrow } from "@/components/primitives";
import {
  IconArrowLeft,
  IconUpload,
  IconArrowRight,
  IconNotes,
} from "@/components/icons";
import { getStudent, getSessions, aggregateWeakTopics } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export default function StudentProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const student = getStudent(params.id);
  if (!student) notFound();

  const sessions = getSessions(student.id);
  const weakTopics = aggregateWeakTopics(student.id);

  return (
    <>
      <Background dim />
      <AppShell>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
        >
          <IconArrowLeft width={16} height={16} />
          Back to students
        </Link>

        {/* Profile header */}
        <header className="animate-rise-in card-sticker mt-6 overflow-hidden p-7 sm:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-5">
              <Avatar name={student.name} tone={student.avatarTone} size="lg" />
              <div>
                <Eyebrow>Student profile</Eyebrow>
                <h1 className="mt-2 font-display text-4xl text-ink">
                  {student.name}
                </h1>
                <p className="mt-1 text-ink-soft">
                  {student.subject} · {student.gradeLevel}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button className="btn-ghost">Edit details</button>
              <Link href={`/students/${student.id}/upload`} className="btn-accent">
                <IconUpload width={18} height={18} />
                Upload session
              </Link>
            </div>
          </div>

          {/* Detail grid */}
          <dl className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-ink/10 bg-ink/10 sm:grid-cols-3">
            <div className="bg-paper p-5">
              <dt className="label">Goals</dt>
              <dd className="mt-1 text-sm text-ink text-pretty">{student.goals}</dd>
            </div>
            <div className="bg-paper p-5">
              <dt className="label">Parent / client email</dt>
              <dd className="mt-1 text-sm text-ink">{student.parentEmail}</dd>
            </div>
            <div className="bg-paper p-5">
              <dt className="label">Sessions logged</dt>
              <dd className="mt-1 font-display text-2xl text-ink">{sessions.length}</dd>
            </div>
          </dl>
        </header>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.7fr_1fr]">
          {/* Timeline */}
          <section>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-ink">Session timeline</h2>
              <span className="text-sm text-ink-faint">{sessions.length} total</span>
            </div>

            {sessions.length === 0 ? (
              <div className="card mt-5 flex flex-col items-center justify-center p-12 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-soft text-violet-deep">
                  <IconNotes width={26} height={26} />
                </span>
                <p className="mt-4 font-display text-lg text-ink">No sessions yet</p>
                <p className="mt-1 max-w-xs text-sm text-ink-soft">
                  Upload {student.name.split(" ")[0]}&apos;s first recording to start building their history.
                </p>
                <Link href={`/students/${student.id}/upload`} className="btn-accent mt-6">
                  <IconUpload width={18} height={18} />
                  Upload first session
                </Link>
              </div>
            ) : (
              <ol className="mt-5 space-y-4">
                {sessions.map((session, i) => {
                  const isReady = session.status === "ready";
                  const cardClass = `card block p-5 transition-all ${
                    isReady ? "hover:-translate-y-0.5 hover:shadow-soft-lg" : "opacity-90"
                  }`;

                  const inner = (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <time className="text-sm font-medium text-ink-soft">
                          {formatDate(session.sessionDate)}
                        </time>
                        <StatusBadge status={session.status} />
                      </div>
                      <p className="mt-2 text-ink text-pretty">
                        {session.oneLineSummary}
                      </p>
                      {isReady && (
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex flex-wrap gap-1.5">
                            {session.output?.weak_topics.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink-soft"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-violet">
                            View outputs
                            <IconArrowRight width={15} height={15} />
                          </span>
                        </div>
                      )}
                      {session.status === "error" && (
                        <p className="mt-2 text-sm text-coral">
                          Re-upload the recording to try again.
                        </p>
                      )}
                    </>
                  );

                  return (
                    <li key={session.id} className="relative pl-8">
                      {/* timeline rail */}
                      <span className="absolute left-2 top-2 h-3 w-3 rounded-full border-2 border-violet bg-bone" />
                      {i < sessions.length - 1 && (
                        <span className="absolute left-[0.81rem] top-5 h-full w-px bg-ink/12" />
                      )}

                      {isReady ? (
                        <Link href={`/sessions/${session.id}/review`} className={cardClass}>
                          {inner}
                        </Link>
                      ) : (
                        <div className={cardClass}>{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* Weak-topic rollup */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="card-sticker p-6">
              <Eyebrow>Recurring weak topics</Eyebrow>
              <h2 className="mt-3 font-display text-xl text-ink">
                What keeps coming up
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                Aggregated across every session — and fed forward into the next AI prep.
              </p>

              {weakTopics.length === 0 ? (
                <p className="mt-6 rounded-2xl bg-bone/70 p-4 text-sm text-ink-faint">
                  Weak topics will appear here once sessions are analyzed.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {weakTopics.map((t) => {
                    const max = weakTopics[0].count;
                    return (
                      <div key={t.topic}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-ink">{t.topic}</span>
                          <span className="text-ink-faint">{t.count}×</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/8">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet to-coral"
                            style={{ width: `${(t.count / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      </AppShell>
    </>
  );
}
