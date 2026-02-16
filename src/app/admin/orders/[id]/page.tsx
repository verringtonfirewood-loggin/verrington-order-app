// src/app/admin/orders/[id]/page.tsx
import Link from "next/link";
import { getPrisma } from "@/lib/prisma";
import StatusEditor from "./StatusEditor";

export const dynamic = "force-dynamic";

const prisma = getPrisma();

function formatPence(pence: number) {
  return `£${(Number(pence) / 100).toFixed(2)}`;
}

export default async function AdminOrderPage({
  params,
}: {
  params: { id: string };
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: true },
  });

  if (!order) {
    return (
      <div className="p-6">
        <Link href="/admin/orders" className="text-purple-700 underline">
          ← Orders
        </Link>
        <p className="mt-4">Order not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Link href="/admin/orders" className="text-purple-700 underline">
        ← Orders
      </Link>

      <div className="mt-4 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold">{order.orderNumber ?? order.id}</h1>
          <div className="mt-2 text-sm opacity-70">
            Created: {new Date(order.createdAt).toLocaleString()}
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm opacity-70">Total</div>
          <div className="text-3xl font-bold">{formatPence(order.totalPence)}</div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold">Status</h2>
        <div className="mt-2">
          <StatusEditor orderId={order.id} initialStatus={order.status} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Items</h2>
        <ul className="mt-2 list-disc pl-5">
          {order.items.map((it) => (
            <li key={it.id}>
              {it.quantity} × {it.name} — {formatPence(it.pricePence)} each — line{" "}
              {formatPence(it.lineTotalPence)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
