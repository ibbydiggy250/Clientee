/** Temporary holding page until the landing page is designed. */
export default function HomePage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6">
      <div aria-hidden className="glow pointer-events-none absolute -inset-24" />
      <div className="relative text-center">
        <p className="text-sm uppercase tracking-[0.4em] opacity-60">TutorMe</p>
        <h1 className="mt-4 text-6xl font-semibold tracking-tight sm:text-8xl">
          Something good
          <br />
          <span className="italic text-[var(--ember)]">is being built.</span>
        </h1>
      </div>
    </main>
  );
}
