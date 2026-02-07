import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: true },
  });

  return (
    <main className="min-h-screen p-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold" style={{ color: "var(--vf-text)" }}>
          Admin — Latest Orders
        </h1>

        <p className="mt-2 text-sm" style={{ color: "var(--vf-muted)" }}>
          Showing the most recent orders.
        </p>

        <div className="mt-8 space-y-4">
          {orders.length === 0 ? (
            <div className="rounded-2xl border p-6" style={{ background: "var(--vf-surface)" }}>
              <p className="text-base font-semibold">No orders yet</p>
              <p className="mt-2 text-sm" style={{ color: "var(--vf-muted)" }}>
                When orders start coming in, they’ll appear here.
              </p>
            </div>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="rounded-2xl border p-6" style={{ background: "var(--vf-surface)" }}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">{o.customerName}</p>
                    <p className="mt-1 text-sm" style={{ color: "var(--vf-muted)" }}>
                      {o.createdAt.toLocaleString()} • {o.postcode} • {o.status}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: "var(--vf-muted)" }}>
                      {o.customerPhone}
                      {o.customerEmail ? ` • ${o.customerEmail}` : ""}
                    </p>

                    <div className="mt-3 space-y-1">
                      {o.items.map((i) => (
                        <p key={i.id} className="text-sm" style={{ color: "var(--vf-muted)" }}>
                          {i.quantity} × {i.name} (£{(i.pricePence / 100).toFixed(2)})
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="text-xl font-bold">£{(o.totalPence / 100).toFixed(2)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
