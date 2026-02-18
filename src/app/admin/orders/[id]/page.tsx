// src/app/admin/orders/[id]/page.tsx
import Link from "next/link";
import { getPrisma } from "@/lib/prisma";
import StatusEditor from "./StatusEditor";
import HusbandryPanel from "./HusbandryPanel";
import OrderActionsClient from "./OrderActionsClient";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const prisma = getPrisma();
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      husbandryLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) {
    return (
      <div className="p-6">
        <Link href="/admin/orders" className="text-purple-700 underline">
          ← Orders
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Order not found</h1>
      </div>
    );
  }

  const isCancelled = order.status === "CANCELLED";
  const isArchived = !!order.archivedAt;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/admin/orders" className="text-purple-700 underline">
            ← Orders
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">
            Order{" "}
            {order.orderNumber ? <span className="text-gray-500">({order.orderNumber})</span> : null}
          </h1>
          <div className="mt-2 text-sm text-gray-600">
            Created: {new Date(order.createdAt).toLocaleString()}
          </div>
        </div>

        {/* ✅ interactive actions moved to a Client Component */}
        <OrderActionsClient orderId={order.id} isCancelled={isCancelled} isArchived={isArchived} />
      </div>

      {/* Status + Cancel Reason */}
      <div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-700">
            <div>
              <span className="font-semibold">Status:</span> {order.status}
              {order.cancelledAt ? (
                <span className="ml-2 text-gray-500">
                  (cancelled {new Date(order.cancelledAt).toLocaleString()})
                </span>
              ) : null}
              {order.archivedAt ? (
                <span className="ml-2 text-gray-500">
                  (archived {new Date(order.archivedAt).toLocaleString()})
                </span>
              ) : null}
            </div>
            {order.cancelReason ? (
              <div className="mt-1">
                <span className="font-semibold">Cancel reason:</span>{" "}
                <span className="text-gray-800">{order.cancelReason}</span>
              </div>
            ) : null}
          </div>

          <StatusEditor orderId={order.id} currentStatus={order.status} />
        </div>
      </div>

      {/* Items */}
      <div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold">Items</h2>
        <div className="mt-3 space-y-2">
          {order.items.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="text-sm">
                <div className="font-semibold">{it.name}</div>
                <div className="text-gray-500">
                  Qty: {it.quantity} • £{(it.pricePence / 100).toFixed(2)}
                </div>
              </div>
              <div className="text-sm font-semibold">£{(it.lineTotalPence / 100).toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>£{(order.subtotalPence / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>£{(order.deliveryFeePence / 100).toFixed(2)}</span>
          </div>
          <div className="mt-2 flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>£{(order.totalPence / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Husbandry */}
      <HusbandryPanel
        orderId={order.id}
        logs={(order.husbandryLogs || []).map((l) => ({
          id: l.id,
          createdAt: l.createdAt.toISOString(),
          author: l.author,
          note: l.note,
        }))}
      />
    </div>
  );
}
