// src/app/admin/orders/page.tsx
import Link from "next/link";
import { getPrisma } from "@/lib/prisma";
import OrdersTableClient from "./OrdersTableClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const prisma = getPrisma();

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
          >
            ← Admin home
          </Link>

          <Link
            href="/admin/dispatch"
            className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
          >
            ← Back to dispatch
          </Link>
        </div>

        <h1 className="text-3xl font-semibold">Orders ({orders.length})</h1>
      </div>

      <OrdersTableClient orders={orders as any} />
    </div>
  );
}
