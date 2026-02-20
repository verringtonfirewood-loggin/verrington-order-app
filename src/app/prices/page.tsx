import Link from "next/link";
import { getPrisma } from "@/lib/prisma";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  pricePence: number;
  imageUrl?: string | null;
  imageAlt?: string | null;
  sortOrder?: number | null;
};

function formatGBPFromPence(pence: number) {
  const gbp = (pence || 0) / 100;
  return `£${gbp.toFixed(2)}`;
}

// --- Configure your comparison + badges here ---
const MOST_POPULAR_NAME = "Bulk Bag of Logs"; // change if you want e.g. "IBC Crate of Logs"

function normaliseName(s: string) {
  return (s || "").trim().toLowerCase();
}

function pickByName(products: Product[], names: string[]) {
  const target = names.map(normaliseName);
  return products.find((p) => target.includes(normaliseName(p.name)));
}

// Optional helpful copy per product type (pure UI polish)
function bestForCopy(name: string) {
  const n = normaliseName(name);
  if (n.includes("net")) return "Best for: occasional fires & top-ups";
  if (n.includes("bulk") || n.includes("bag")) return "Best for: regular burners (great value)";
  if (n.includes("ibc") || n.includes("crate")) return "Best for: high usage / winter stock-up";
  return "Best for: local delivery customers";
}

function bulletsCopy(name: string) {
  const n = normaliseName(name);
  if (n.includes("net")) {
    return ["Quick top-up", "Easy to carry", "Perfect for weekends"];
  }
  if (n.includes("bulk") || n.includes("bag")) {
    return ["Most popular choice", "Great value per load", "Ideal for stove owners"];
  }
  if (n.includes("ibc") || n.includes("crate")) {
    return ["Maximum volume", "Best for heavy users", "Stock up for the season"];
  }
  return ["Local delivery", "Reliable service", "Easy ordering"];
}

async function loadProducts(): Promise<Product[]> {
  const prisma = getPrisma();

  // Pull directly from DB (no internal fetch)
  const rows = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      pricePence: true,
      imageUrl: true,
      imageAlt: true,
      sortOrder: true,
    },
  });

  return rows;
}

export default async function PricesPage() {
  let products: Product[] = [];

  try {
    products = await loadProducts();
  } catch {
    // graceful fallback (keeps UI message)
  }

  // Prefer sortOrder if present, otherwise keep API order
  const sorted = [...products].sort((a, b) => {
    const sa = typeof a.sortOrder === "number" ? a.sortOrder : 999;
    const sb = typeof b.sortOrder === "number" ? b.sortOrder : 999;
    return sa - sb;
  });

  // Try to identify your three core products by name (handles slight name variations)
  const net =
    pickByName(sorted, ["Net of Logs", "Net Logs", "Logs Net"]) ??
    sorted.find((p) => normaliseName(p.name).includes("net")) ??
    null;

  const bag =
    pickByName(sorted, ["Bulk Bag of Logs", "Bulk Bag", "Bulk Bag Logs"]) ??
    sorted.find((p) => normaliseName(p.name).includes("bulk")) ??
    sorted.find((p) => normaliseName(p.name).includes("bag")) ??
    null;

  const ibc =
    pickByName(sorted, ["IBC Crate of Logs", "IBC Crate", "IBC"]) ??
    sorted.find((p) => normaliseName(p.name).includes("ibc")) ??
    sorted.find((p) => normaliseName(p.name).includes("crate")) ??
    null;

  // Build comparison list: prefer Net/Bag/IBC if found, else just show everything
  const comparison = net || bag || ibc ? ([net, bag, ibc].filter(Boolean) as Product[]) : sorted;

  return (
    <main className="min-h-screen bg-[var(--vf-bg)] text-[var(--vf-text)]">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-extrabold">Prices</h1>
        <p className="mt-2 text-[var(--vf-muted)]">
          Straightforward pricing. Delivery (if any) is confirmed after ordering based on your postcode.
        </p>

        {/* Comparison layout */}
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {comparison.length === 0 ? (
            <div className="rounded-3xl border p-6 text-sm text-[var(--vf-muted)]" style={{ background: "var(--vf-surface)" }}>
              Prices are temporarily unavailable. Please visit the order page.
            </div>
          ) : (
            comparison.map((p) => {
              const isPopular = normaliseName(p.name) === normaliseName(MOST_POPULAR_NAME);

              return (
                <div
                  key={p.id}
                  className="relative rounded-3xl border p-6 shadow-sm"
                  style={{
                    background: "var(--vf-surface)",
                    boxShadow: isPopular ? "0 18px 50px rgba(0,0,0,0.10)" : undefined,
                    transform: isPopular ? "translateY(-2px)" : undefined,
                  }}
                >
                  {/* Most popular badge */}
                  {isPopular ? (
                    <div className="absolute right-4 top-4">
                      <span
                        className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-extrabold"
                        style={{
                          background: "rgba(245, 158, 11, 0.14)",
                          borderColor: "rgba(0,0,0,0.10)",
                        }}
                      >
                        ⭐ Most popular
                      </span>
                    </div>
                  ) : null}

                  <div className="text-lg font-extrabold">{p.name}</div>

                  <div className="mt-2 text-3xl font-extrabold">{formatGBPFromPence(p.pricePence)}</div>

                  {p.description ? (
                    <p className="mt-2 text-sm text-[var(--vf-muted)]">{p.description}</p>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--vf-muted)]">{bestForCopy(p.name)}</p>
                  )}

                  <ul className="mt-4 space-y-2 text-sm">
                    {bulletsCopy(p.name).map((b) => (
                      <li key={b} className="flex gap-2">
                        <span aria-hidden>✓</span>
                        <span className="text-[var(--vf-muted)]">{b}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex gap-3">
                    <Link
                      href="/order"
                      className="rounded-2xl px-5 py-3 text-sm font-semibold"
                      style={{
                        background: "var(--vf-primary)",
                        color: "var(--vf-primary-contrast)",
                      }}
                    >
                      Order
                    </Link>

                    <Link href="/delivery" className="rounded-2xl border px-5 py-3 text-sm font-semibold hover:bg-black/5">
                      Delivery
                    </Link>
                  </div>

                  <p className="mt-4 text-xs text-[var(--vf-muted)]">
                    Delivery fee (if any) and final totals are confirmed after submission.
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Optional: quick “at a glance” table */}
        {comparison.length >= 2 ? (
          <div className="mt-8 rounded-3xl border p-6" style={{ background: "var(--vf-surface)" }}>
            <h2 className="text-lg font-extrabold">At a glance</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-2 pr-4">Product</th>
                    <th className="py-2 pr-4">Price</th>
                    <th className="py-2 pr-4">Best for</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  {comparison.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="py-3 pr-4 font-semibold">
                        {p.name}{" "}
                        {normaliseName(p.name) === normaliseName(MOST_POPULAR_NAME) ? (
                          <span className="ml-2 text-xs font-extrabold">⭐</span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 font-extrabold">{formatGBPFromPence(p.pricePence)}</td>
                      <td className="py-3 pr-4 text-[var(--vf-muted)]">{bestForCopy(p.name)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex gap-3">
              <Link
                href="/order"
                className="rounded-2xl px-6 py-3 text-sm font-semibold"
                style={{
                  background: "var(--vf-primary)",
                  color: "var(--vf-primary-contrast)",
                }}
              >
                Order now
              </Link>
              <Link href="/" className="rounded-2xl border px-6 py-3 text-sm font-semibold hover:bg-black/5">
                Back home
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
