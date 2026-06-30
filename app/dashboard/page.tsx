import Link from "next/link";
import { Background } from "@/components/background";
import { AppShell } from "@/components/app-shell";
import { Avatar, Eyebrow } from "@/components/primitives";
import { IconPlus, IconArrowRight, IconWave } from "@/components/icons";
import {
  students,
  getSessions,
  lastSessionDate,
  aggregateWeakTopics,
} from "@/lib/mock-data";
import { relativeDay } from "@/lib/utils";

export default function DashboardPage() {
  const totalSessions = students.reduce(
    (n, s) => n + getSessions(s.id).length,
    0,
  );

  return (
    <>
      <Background dim />
      <AppShell>
        {/* Heading */}
        <div className="animate-rise-in flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <Eyebrow>Your studio</Eyebrow>
            <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
              Good evening, Jordan.
            </h1>
            <p className="mt-3 text-lg text-ink-soft">
              {students.length} students · {totalSessions} sessions logged so far.
            </p>
          </div>
          <Link href="/students/new" className="btn-accent">
            <IconPlus width={18} height={18} />
            New student
          </Link>
        </div>

        {/* Student grid */}
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => {
            const last = lastSessionDate(student.id);
            const sessionCount = getSessions(student.id).length;
            const topTopics = aggregateWeakTopics(student.id).slice(0, 2);

            return (
              <Link
                key={student.id}
                href={`/students/${student.id}`}
                className="card group relative flex flex-col p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-soft-lg"
              >
                <div className="flex items-start justify-between">
                  <Avatar name={student.name} tone={student.avatarTone} />
                  <span className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition-all group-hover:bg-ink group-hover:text-bone">
                    <IconArrowRight width={16} height={16} />
                  </span>
                </div>

                <h3 className="mt-5 font-display text-xl text-ink">
                  {student.name}
                </h3>
                <p className="text-sm text-ink-soft">
                  {student.subject} · {student.gradeLevel}
                </p>

                <div className="mt-5 flex flex-wrap gap-1.5">
                  {topTopics.length > 0 ? (
                    topTopics.map((t) => (
                      <span
                        key={t.topic}
                        className="rounded-full bg-violet-soft/60 px-2.5 py-1 text-xs font-medium text-violet-deep"
                      >
                        {t.topic}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-ink-faint">No weak topics tagged yet</span>
                  )}
                </div>

                <div className="mt-6 flex items-center gap-2 border-t border-ink/8 pt-4 text-sm text-ink-faint">
                  <IconWave width={16} height={16} className="text-violet" />
                  {last
                    ? `Last session ${relativeDay(last)}`
                    : "No sessions yet"}
                  <span className="ml-auto font-medium text-ink-soft">
                    {sessionCount}×
                  </span>
                </div>
              </Link>
            );
          })}

          {/* Add-student tile */}
          <Link
            href="/students/new"
            className="group flex min-h-[15rem] flex-col items-center justify-center rounded-4xl border-2 border-dashed border-ink/20 p-6 text-center transition-colors hover:border-violet hover:bg-violet-soft/30"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-bone transition-transform group-hover:rotate-90">
              <IconPlus width={24} height={24} />
            </span>
            <p className="mt-4 font-display text-lg text-ink">Add a student</p>
            <p className="mt-1 text-sm text-ink-faint">
              Create a profile to start logging sessions
            </p>
          </Link>
        </div>
      </AppShell>
    </>
  );
}
