import Image from "next/image";
import Link from "next/link";
import GoogleRatingBadge from "@/components/GoogleRatingBadge";

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--vf-bg)] text-[var(--vf-text)]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-[color:var(--vf-bg)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Verrington Firewood"
              width={160}
              height={54}
              priority
            />
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight">
                Verrington Firewood
              </div>
              <div className="text-sm text-[var(--vf-muted)]">
                South Somerset &amp; North Dorset
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/prices"
              className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-black/5"
            >
              Prices
            </Link>
            <Link
              href="/delivery"
              className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-black/5"
            >
              Delivery areas
            </Link>
            <Link
              href="/order"
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{
                background: "var(--vf-primary)",
                color: "var(--vf-primary-contrast)",
              }}
            >
              Order firewood
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero (log-wall banner) */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border shadow-sm">
          <div
            className="relative min-h-[360px] bg-cover bg-center sm:min-h-[420px]"
            style={{ backgroundImage: "url('/log-wall.jpg')" }}
          >
            {/* Overlays for readability */}
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(22,16,10,0.78) 0%, rgba(22,16,10,0.25) 55%, rgba(22,16,10,0.60) 100%)",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/30 to-transparent" />

            <div className="relative p-8 sm:p-10">
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold"
                style={{
                  borderColor: "rgba(255,255,255,0.22)",
                  background: "rgba(0,0,0,0.25)",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                <span>🔥</span>
                <span>Ready to burn • Local • Reliable</span>
              </div>

              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white drop-shadow sm:text-5xl">
                Seasoned Firewood Delivered
              </h1>

              <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/90 drop-shadow">
                Order in minutes. We’ll confirm your delivery day and keep you
                updated. Serving{" "}
                <span className="font-semibold text-white">South Somerset</span>{" "}
                and{" "}
                <span className="font-semibold text-white">North Dorset</span>.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/order"
                  className="rounded-xl px-5 py-3 text-sm font-semibold"
                  style={{
                    background: "var(--vf-primary)",
                    color: "var(--vf-primary-contrast)",
                  }}
                >
                  Order firewood
                </Link>

                <Link
                  href="/delivery"
                  className="rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-white/10"
                  style={{
                    borderColor: "rgba(255,255,255,0.28)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  Check delivery areas
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="px-6 pb-12">
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
          {[
            {
              icon: "🪵",
              title: "Seasoned hardwood",
              text: "Clean-burning logs, ready for your stove or open fire.",
            },
            {
              icon: "🚚",
              title: "Local delivery",
              text: "Fast, friendly deliveries across South Somerset & North Dorset.",
            },
            {
              icon: "📲",
              title: "Simple ordering",
              text: "Choose your load, add your postcode, and place your order.",
            },
          ].map((t) => (
            <div
              key={t.title}
              className="rounded-3xl border p-6"
              style={{ background: "var(--vf-surface)" }}
            >
              <div className="text-xl">{t.icon}</div>
              <div className="mt-2 font-bold">{t.title}</div>
              <p className="mt-1 text-sm text-[var(--vf-muted)]">{t.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-8 border-t px-6 py-8 text-sm text-[var(--vf-muted)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>&copy; {new Date().getFullYear()} Verrington Firewood</div>

          <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Link
                className="rounded-xl px-2 py-1 hover:bg-black/5"
                href="/order"
              >
                Order
              </Link>
              <span>&middot;</span>
              <Link
                className="rounded-xl px-2 py-1 hover:bg-black/5"
                href="/prices"
              >
                Prices
              </Link>
              <span>&middot;</span>
              <Link
                className="rounded-xl px-2 py-1 hover:bg-black/5"
                href="/delivery"
              >
                Delivery
              </Link>
            </div>

            <div className="w-full sm:w-auto sm:min-w-[280px]">
              <GoogleRatingBadge />
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
