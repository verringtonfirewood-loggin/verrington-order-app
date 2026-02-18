// src/app/admin/orders/[id]/page.tsx
import Link from "next/link";
import prisma from "@/lib/prisma";
import StatusEditor from "./StatusEditor";
import HusbandryPanel from "./HusbandryPanel";

function money(pence: number) {
  const gbp = (pence ?? 0) / 100;
  return gbp.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      husbandryLogs: {
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, note: true, author: true },
      },
    },
  });

  if (!order) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <Link href="/admin/orders" className="text-purple-700 underline">
          ← Orders
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Order not found</h1>
      </main>
    );
  }

  const isCancelled = order.status === "CANCELLED" || !!order.cancelledAt;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <Link href="/admin/orders" className="text-purple-700 underline">
        ← Orders
      </Link>

      <div className="mt-4 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">
          Order {order.orderNumber ? `(${order.orderNumber})` : ""}
        </h1>

        <div className="text-sm text-gray-700">
          Status:{" "}
          <span className={isCancelled ? "font-semibold text-red-700" : "font-semibold"}>
            {order.status}
          </span>
          {order.archivedAt ? (
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
              Archived
            </span>
          ) : null}
        </div>

        {isCancelled ? (
          <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="font-semibold text-red-800">Cancelled</div>
            {order.cancelReason ? (
              <div className="mt-1 text-sm text-red-800">Reason: {order.cancelReason}</div>
            ) : (
              <div className="mt-1 text-sm text-red-800">No reason recorded.</div>
            )}
          </div>
        ) : null}
      </div>

      <StatusEditor
        orderId={order.id}
        initialStatus={order.status}
        initialArchivedAt={order.archivedAt ? order.archivedAt.toISOString() : null}
        initialCancelledAt={order.cancelledAt ? order.cancelledAt.toISOString() : null}
        initialCancelReason={order.cancelReason ?? null}
      />

      <section className="mt-10 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold">Customer</h2>
        <div className="mt-3 grid gap-1 text-sm">
          <div><span className="font-medium">Name:</span> {order.customerName}</div>
          {order.customerPhone ? <div><span className="font-medium">Phone:</span> {order.customerPhone}</div> : null}
          {order.customerEmail ? <div><span className="font-medium">Email:</span> {order.customerEmail}</div> : null}
          <div className="mt-2">
            <span className="font-medium">Postcode:</span> {order.postcode}
          </div>
          {order.addressLine1 ? <div>{order.addressLine1}</div> : null}
          {order.addressLine2 ? <div>{order.addressLine2}</div> : null}
          {order.town ? <div>{order.town}</div> : null}
          {order.county ? <div>{order.county}</div> : null}
          {order.deliveryNotes ? (
            <div className="mt-2">
              <span className="font-medium">Notes:</span> {order.deliveryNotes}
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-10 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold">Items</h2>
        <div className="mt-4 space-y-2">
          {order.items.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium">{it.name}</div>
                <div className="text-sm text-gray-600">
                  {it.quantity} × {money(it.pricePence)}
                </div>
              </div>
              <div className="font-semibold">{money(it.lineTotalPence)}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">{money(order.subtotalPence)}</span></div>
          <div className="flex justify-between"><span>Delivery</span><span className="font-medium">{money(order.deliveryFeePence)}</span></div>
          <div className="mt-2 flex justify-between text-base"><span className="font-semibold">Total</span><span className="font-semibold">{money(order.totalPence)}</span></div>
        </div>
      </section>

      <HusbandryPanel
        orderId={order.id}
        initialLogs={(order.husbandryLogs || []).map((l) => ({
          id: l.id,
          createdAt: l.createdAt.toISOString(),
          note: l.note,
          author: l.author,
        }))}
      />
    </main>
  );
}
