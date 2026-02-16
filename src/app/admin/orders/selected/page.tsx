// src/app/admin/orders/selected/page.tsx
import Link from "next/link";
import { getPrisma } from "@/lib/prisma";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatPence(pence: number) {
  return `£${(Number(pence) / 100).toFixed(2)}`;
}

function parseIds(ids: unknown): string[] {
  const str =
    typeof ids === "string" ? ids : Array.isArray(ids) ? ids[0] : "";

  if (!str) return [];

  return str
    .split(",")
    .map((s: string) => s.trim())
    .filter((s: string) => Boolean(s));
}

export default async function SelectedOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;              // ✅ key fix
  const ids = parseIds(sp?.ids);              // ✅ now works

  const prisma = getPrisma();

  console.log("SelectedOrdersPage raw ids:", sp?.ids);
  console.log("SelectedOrdersPage parsed ids:", ids);

  if (!ids.length) {
    return (
      <div className="p-6">
        <Link href="/admin/orders" className="text-purple-700 underline">
          ← Orders
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Selected orders</h1>
        <p className="mt-2">No orders selected.</p>
      </div>
    );
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: ids } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  if (!orders.length) {
    return (
      <div className="p-6">
        <Link href="/admin/orders" className="text-purple-700 underline">
          ← Orders
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Selected orders</h1>
        <p className="mt-2">Orders not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/admin/orders" className="text-purple-700 underline">
          ← Orders
        </Link>
        <PrintButton />
      </div>

      <h1 className="mt-4 text-3xl font-semibold">
        Selected orders ({orders.length})
      </h1>

      <div className="mt-6 space-y-6">
        {orders.map((o) => (
          <div key={o.id} className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-2xl font-bold">{o.orderNumber ?? o.id}</div>
                <div className="mt-1 text-sm opacity-70">
                  Created: {new Date(o.createdAt).toLocaleString()}
                </div>
                <div className="mt-1 text-sm opacity-70">
                  Postcode: <span className="font-semibold">{o.postcode}</span>
                </div>
                <div className="mt-2 font-semibold">{o.customerName}</div>
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
              </div>
            </div>

            <hr className="my-4" />

            <div className="text-lg font-semibold">Items</div>
            <ul className="mt-2 list-disc pl-5">
              {o.items.map((it) => (
                <li key={it.id}>
                  {it.quantity} × {it.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
