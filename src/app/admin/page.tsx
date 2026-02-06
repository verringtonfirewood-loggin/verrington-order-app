export default function AdminPage() {
  const orders: Array<{
    id: string;
    createdAt: string;
    customerName: string;
    total: string;
    status: string;
  }> = [];

  return (
    <main className="min-h-screen p-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold" style={{ color: "var(--vf-text)" }}>
          Admin — Latest Orders
        </h1>

        <p className="mt-2 text-sm" style={{ color: "var(--vf-muted)" }}>
          Protected area. Showing the most recent orders.
        </p>

        <div
          className="mt-8 rounded-2xl border p-6"
          style={{ background: "var(--vf-surface)" }}
        >
          {orders.length === 0 ? (
            <div>
              <p className="text-base font-semibold">No orders yet</p>
              <p className="mt-2 text-sm" style={{ color: "var(--vf-muted)" }}>
                When orders start coming in, they’ll appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((o) => (
                <div key={o.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{o.customerName}</p>
                      <p className="text-sm" style={{ color: "var(--vf-muted)" }}>
                        {o.createdAt} • {o.status}
                      </p>
                    </div>
                    <div className="text-lg font-bold">{o.total}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-6 text-xs" style={{ color: "var(--vf-muted)" }}>
          Next step: connect this page to the Orders API (then Prisma).
        </p>
      </div>
    </main>
  );
}
