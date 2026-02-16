// app/admin/orders/selected/page.tsx
import Link from "next/link";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function parseIds(searchParams: Record<string, string | string[] | undefined>) {
  const raw = searchParams.ids;
  const str = Array.isArray(raw) ? raw[0] : raw;
  if (!str) return [];
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatPence(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

export default async function SelectedOrdersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const ids = parseIds(searchParams);

  if (ids.length === 0) {
    return (
      <div className="p-6">
        <Link href="/admin/orders" className="text-purple-700 underline">
          ← Orders
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Selected orders</h1>
        <p className="mt-2">No orders selected.</p>
      </div>
    );
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: ids } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  // Preserve the exact order from the selection list
  const map = new Map(orders.map((o) => [o.id, o]));
  const ordered = ids.map((id) => map.get(id)).filter(Boolean) as typeof orders;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/admin/orders" className="text-purple-700 underline">
          ← Orders
        </Link>

        <button
          onClick={() => window.print()}
          className="rounded-lg bg-black px-4 py-2 text-white"
        >
          Print page
        </button>
      </div>

      <h1 className="mt-4 text-3xl font-semibold">
        Selected orders ({ordered.length})
      </h1>

      <div className="mt-6 space-y-8">
        {ordered.map((o) => (
          <div
            key={o.id}
            className="rounded-xl border bg-white p-6 shadow-sm print:break-inside-avoid"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-2xl font-bold">
                  {o.orderNumber ?? o.id}
                </div>
                <div className="mt-1 text-sm opacity-70">
                  Created: {new Date(o.createdAt).toLocaleString()}
                </div>
                <div className="mt-1 text-sm opacity-70">
                  Postcode: <span className="font-semibold">{o.postcode}</span>
                </div>

                {(o.addressLine1 || o.town || o.county) && (
                  <div className="mt-2 text-sm">
                    <div className="font-semibold">Address</div>
                    {o.addressLine1 && <div>{o.addressLine1}</div>}
                    {o.addressLine2 && <div>{o.addressLine2}</div>}
                    <div>
                      {[o.town, o.county].filter(Boolean).join(", ")}
                    </div>
                  </div>
                )}
              </div>

              <div className="text-right">
                <div className="text-sm opacity-70">Total</div>
                <div className="text-2xl font-bold">
                  {formatPence(o.totalPence)}
                </div>
                <div className="mt-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                    {o.status}
                  </span>
                </div>
                <div className="mt-2 text-sm opacity-70">
                  Payment: {o.paymentStatus}
                </div>
              </div>
            </div>

            <hr className="my-4" />

            <div className="text-lg font-semibold">Customer</div>
            <div className="mt-1">{o.customerName}</div>
            {o.customerEmail && <div className="opacity-70">{o.customerEmail}</div>}
            {o.customerPhone && <div className="opacity-70">{o.customerPhone}</div>}

            {o.deliveryNotes && (
              <div className="mt-4">
                <div className="text-lg font-semibold">Delivery notes</div>
                <div className="mt-1 whitespace-pre-wrap">{o.deliveryNotes}</div>
              </div>
            )}

            <div className="mt-4 text-lg font-semibold">Items</div>
            <ul className="mt-2 list-disc pl-5">
              {o.items.map((it) => (
                <li key={it.id}>
                  {it.quantity} × {it.name} —{" "}
                  {formatPence(it.pricePence)} each — line {formatPence(it.lineTotalPence)}
                </li>
              ))}
            </ul>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-sm opacity-70">Subtotal</div>
                <div className="text-lg font-semibold">{formatPence(o.subtotalPence)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-sm opacity-70">Delivery</div>
                <div className="text-lg font-semibold">{formatPence(o.deliveryFeePence)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-sm opacity-70">Total</div>
                <div className="text-lg font-semibold">{formatPence(o.totalPence)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
