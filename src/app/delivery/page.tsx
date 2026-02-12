import Link from "next/link";

export default function DeliveryPage() {
  return (
    <main className="min-h-screen bg-[var(--vf-bg)] text-[var(--vf-text)]">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-extrabold">Delivery Areas</h1>
        <p className="mt-2 text-[var(--vf-muted)]">
          We deliver across South Somerset & North Dorset. If you’re nearby, still place an order — we’ll confirm.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {["BA postcodes", "DT postcodes", "SP postcodes", "TA postcodes"].map((a) => (
            <div key={a} className="rounded-3xl border p-6 shadow-sm" style={{ background: "var(--vf-surface)" }}>
              <div className="text-lg font-bold">{a}</div>
              <p className="mt-2 text-sm text-[var(--vf-muted)]">
                Delivery is confirmed after ordering based on your full postcode.
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex gap-3">
          <Link
            href="/order"
            className="rounded-2xl px-6 py-3 text-sm font-semibold"
            style={{ background: "var(--vf-primary)", color: "var(--vf-primary-contrast)" }}
          >
            Place an order
          </Link>
          <Link href="/" className="rounded-2xl border px-6 py-3 text-sm font-semibold hover:bg-black/5">
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
