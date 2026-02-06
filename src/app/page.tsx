export default function Home() {
  return (
    <main className="min-h-screen p-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold" style={{ color: "var(--vf-text)" }}>
          Verrington Order App
        </h1>

        <p className="mt-3 text-lg" style={{ color: "var(--vf-muted)" }}>
          Online ordering for seasoned firewood — fast, simple, reliable.
        </p>

        <div
          className="mt-8 rounded-2xl border p-6"
          style={{ background: "var(--vf-surface)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-base font-semibold">Brand colours applied</p>
              <p className="mt-1 text-sm" style={{ color: "var(--vf-muted)" }}>
                Next: add logos in /public and render them here.
              </p>
            </div>

            <a
              href="#"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold"
              style={{
                background: "var(--vf-primary)",
                color: "var(--vf-primary-contrast)",
              }}
            >
              Continue
            </a>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: "var(--vf-primary)" }}
            aria-label="Primary colour swatch"
          />
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: "var(--vf-accent)" }}
            aria-label="Accent colour swatch"
          />
          <span className="text-sm" style={{ color: "var(--vf-muted)" }}>
            Verrington palette (temporary — we’ll match your actual brand next)
          </span>
        </div>
      </div>
    </main>
  );
}
