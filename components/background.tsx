// Decorative page background: drifting gradient blobs + film grain.
// Purely visual, sits behind content and ignores pointer events.
export function Background({ dim = false }: { dim?: boolean }) {
  return (
    <div
      aria-hidden
      className="grain pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bone"
    >
      {/* warm paper wash */}
      <div className="absolute inset-0 bg-gradient-to-b from-bone via-bone to-bone-deep/60" />

      {/* violet blob */}
      <div
        className="animate-blob-drift absolute -left-32 -top-40 h-[34rem] w-[34rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(91,61,245,0.40), transparent 65%)",
          opacity: dim ? 0.5 : 0.85,
        }}
      />
      {/* coral blob */}
      <div
        className="animate-blob-drift absolute -right-40 top-10 h-[30rem] w-[30rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 60% 40%, rgba(255,106,69,0.35), transparent 65%)",
          animationDelay: "-6s",
          opacity: dim ? 0.45 : 0.8,
        }}
      />
      {/* amber blob low */}
      <div
        className="animate-blob-drift absolute bottom-[-12rem] left-1/3 h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(244,167,32,0.30), transparent 65%)",
          animationDelay: "-12s",
          opacity: dim ? 0.4 : 0.7,
        }}
      />
    </div>
  );
}
