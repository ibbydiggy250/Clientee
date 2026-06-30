"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Background } from "@/components/background";
import { AppShell } from "@/components/app-shell";
import { Eyebrow } from "@/components/primitives";
import { IconArrowLeft, IconUpload, IconWave, IconSpark } from "@/components/icons";
import { getStudent } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function UploadSessionPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const student = getStudent(params.id);

  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function pick(files: FileList | null) {
    if (files && files.length > 0) setFileName(files[0].name);
  }

  // Scaffold: no real upload. Kick straight to the processing screen.
  function startProcessing() {
    router.push(`/sessions/demo/processing`);
  }

  return (
    <>
      <Background dim />
      <AppShell>
        <Link
          href={`/students/${params.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
        >
          <IconArrowLeft width={16} height={16} />
          Back to {student ? student.name : "student"}
        </Link>

        <div className="animate-rise-in mx-auto mt-6 max-w-2xl">
          <Eyebrow>New session</Eyebrow>
          <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
            Drop in the recording.
          </h1>
          <p className="mt-3 text-lg text-ink-soft">
            Audio or video from your session with{" "}
            {student ? student.name.split(" ")[0] : "your student"}. We&apos;ll
            handle the transcription and the rest.
          </p>

          {/* Dropzone */}
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files);
            }}
            className={cn(
              "mt-9 flex cursor-pointer flex-col items-center justify-center rounded-5xl border-2 border-dashed p-12 text-center transition-all duration-200",
              dragging
                ? "border-violet bg-violet-soft/40 scale-[1.01]"
                : "border-ink/25 bg-paper/60 hover:border-violet hover:bg-violet-soft/20",
            )}
          >
            <input
              type="file"
              accept="audio/*,video/*"
              className="hidden"
              onChange={(e) => pick(e.target.files)}
            />
            <span
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-3xl transition-colors",
                fileName ? "bg-sage text-paper" : "bg-ink text-bone",
              )}
            >
              {fileName ? (
                <IconWave width={28} height={28} />
              ) : (
                <IconUpload width={28} height={28} className="animate-float" />
              )}
            </span>

            {fileName ? (
              <>
                <p className="mt-5 font-display text-xl text-ink">{fileName}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  Looks good · choose a different file to replace
                </p>
              </>
            ) : (
              <>
                <p className="mt-5 font-display text-xl text-ink">
                  Drag &amp; drop your recording
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  or <span className="font-semibold text-violet">browse files</span> · MP3, M4A, WAV, MP4, MOV
                </p>
              </>
            )}
          </label>

          {/* What happens next */}
          <div className="mt-6 flex items-start gap-3 rounded-3xl border border-ink/10 bg-bone/60 p-5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-soft text-violet-deep">
              <IconSpark width={18} height={18} />
            </span>
            <p className="text-sm text-ink-soft text-pretty">
              Once uploaded, the file is transcribed with speaker separation,
              then analyzed into five outputs. The original recording is
              discarded after transcription — only the text is kept.
            </p>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3">
            <Link href={`/students/${params.id}`} className="btn-ghost">
              Cancel
            </Link>
            <button
              onClick={startProcessing}
              disabled={!fileName}
              className={cn(
                "btn-accent",
                !fileName && "cursor-not-allowed opacity-40 hover:translate-y-0 hover:shadow-[0.3rem_0.3rem_0_0_#3A23B8]",
              )}
            >
              <IconUpload width={18} height={18} />
              Upload &amp; process
            </button>
          </div>
        </div>
      </AppShell>
    </>
  );
}
