// src/app/admin/orders/[id]/page.tsx
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import StatusEditor from "./StatusEditor";
import BackButton from "@/components/admin/BackButton";

const orderSelect = {
  id: true,
  orderNumber: true,
  status: true,

  customerName: true,
  customerPhone: true,
  customerEmail: true,

  addressLine1: true,
  addressLine2: true,
  town: true,
  county: true,
  postcode: true,

  preferredDay: true,
  deliveryNotes: true,

  subtotalPence: true,
  deliveryFeePence: true,
  totalPence: true,

  archivedAt: true,
  cancelledAt: true,
  cancelReason: true,

  checkoutPaymentMethod: true,
  paymentStatus: true,
  paidAt: true,

  items: {
    select: {
      id: true,
      name: true,
      quantity: true,
      pricePence: true,
      lineTotalPence: true,
    },
  },

  husbandryLogs: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      note: true,
      author: true,
    },
  },
} satisfies Prisma.OrderSelect;

type OrderDetail = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

type PageProps = {
  params: Promise<{ id?: string }>;
};

function formatOrderRef(order: { id: string; orderNumber: unknown }) {
  const raw = order.orderNumber;

  // Already formatted like "VF001"
  if (typeof raw === "string" && /^VF\d{3,}$/i.test(raw.trim())) {
    return raw.trim().toUpperCase();
  }

  // Number or numeric string → VF + pad
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== "" && /^\d+$/.test(raw.trim())
        ? Number(raw.trim())
        : null;

  if (typeof n === "number" && Number.isFinite(n) && n >= 0) {
    const padded = String(Math.trunc(n)).padStart(3, "0");
    return `VF${padded}`;
  }

  // Fallback: try to find digits in id, else use id short
  const digits = String(order.id).match(/\d+/)?.[0];
  if (digits) {
    const padded = digits.slice(-3).padStart(3, "0");
    return `VF${padded}`;
  }

  return order.id.slice(0, 8);
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  if (!id || typeof id !== "string") {
    notFound();
  }

  const order: OrderDetail | null = await prisma.order.findUnique({
    where: { id },
    select: orderSelect,
  });

  if (!order) notFound();

  const orderRef = formatOrderRef({ id: order.id, orderNumber: order.orderNumber });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4">
        <BackButton />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Order {orderRef}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Status: <span className="font-semibold">{order.status}</span>
          </p>
        </div>

        <div className="mt-2 sm:mt-0">
          <StatusEditor
            orderId={order.id}
            initialStatus={order.status}
            initialArchivedAt={order.archivedAt ? order.archivedAt.toISOString() : null}
            initialCancelledAt={order.cancelledAt ? order.cancelledAt.toISOString() : null}
            initialCancelReason={order.cancelReason ?? null}
          />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Customer</h2>
          <div className="mt-3 space-y-1 text-sm">
            <div>
              <span className="text-zinc-500">Name:</span>{" "}
              <span className="font-medium">{order.customerName}</span>
            </div>
            {order.customerPhone && (
              <div>
                <span className="text-zinc-500">Phone:</span>{" "}
                <span className="font-medium">{order.customerPhone}</span>
              </div>
            )}
            {order.customerEmail && (
              <div>
                <span className="text-zinc-500">Email:</span>{" "}
                <span className="font-medium">{order.customerEmail}</span>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Delivery</h2>
          <div className="mt-3 space-y-1 text-sm">
            <div className="font-medium">
              {[order.addressLine1, order.addressLine2].filter(Boolean).join(", ")}
            </div>
            <div className="font-medium">{[order.town, order.county].filter(Boolean).join(", ")}</div>
            <div className="font-medium">{order.postcode}</div>

            {order.preferredDay && (
              <div className="pt-2">
                <span className="text-zinc-500">Preferred day:</span>{" "}
                <span className="font-medium">{order.preferredDay}</span>
              </div>
            )}

            {order.deliveryNotes && (
              <div className="pt-2">
                <div className="text-zinc-500">Notes:</div>
                <div className="mt-1 whitespace-pre-wrap rounded-xl bg-zinc-50 p-3">
                  {order.deliveryNotes}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold">Items</h2>

          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id} className="border-t border-zinc-100">
                    <td className="px-3 py-2 font-medium">{it.name}</td>
                    <td className="px-3 py-2 text-right">{it.quantity}</td>
                    <td className="px-3 py-2 text-right">£{(it.pricePence / 100).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">£{(it.lineTotalPence / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-2 text-sm sm:ml-auto sm:max-w-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Subtotal</span>
              <span className="font-medium">£{(order.subtotalPence / 100).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Delivery</span>
              <span className="font-medium">£{(order.deliveryFeePence / 100).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-semibold">£{(order.totalPence / 100).toFixed(2)}</span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Payment</h2>
          <div className="mt-3 space-y-1 text-sm">
            <div>
              <span className="text-zinc-500">Method:</span>{" "}
              <span className="font-medium">{String(order.checkoutPaymentMethod ?? "—")}</span>
            </div>
            <div>
              <span className="text-zinc-500">Status:</span>{" "}
              <span className="font-medium">{String(order.paymentStatus ?? "—")}</span>
            </div>

            {order.paidAt && (
              <div>
                <span className="text-zinc-500">Paid at:</span>{" "}
                <span className="font-medium">{new Date(order.paidAt).toLocaleString("en-GB")}</span>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Admin trail</h2>
          <div className="mt-3 space-y-3 text-sm">
            {order.husbandryLogs.length === 0 ? (
              <div className="text-zinc-600">No log entries yet.</div>
            ) : (
              <ul className="space-y-2">
                {order.husbandryLogs.map((l) => (
                  <li key={l.id} className="rounded-xl bg-zinc-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">Log</div>
                      <div className="text-xs text-zinc-500">
                        {new Date(l.createdAt).toLocaleString("en-GB")}
                      </div>
                    </div>
                    {l.note && <div className="mt-1 text-zinc-700">{l.note}</div>}
                    {l.author && <div className="mt-1 text-xs text-zinc-500">By: {l.author}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
