// src/app/admin/orders/page.tsx
import { getPrisma } from "@/lib/prisma";
import OrdersTableClient from "./OrdersTableClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminOrdersPage() {
  try {
    const prisma = getPrisma();

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });

    return (
      <div className="p-6">
        <h1 className="text-3xl font-semibold">Orders ({orders.length})</h1>
        <div className="mt-6">
          <OrdersTableClient orders={orders as any} />
        </div>
      </div>
    );
  } catch (err) {
    console.error("AdminOrdersPage error:", err);
    return (
      <div className="p-6">
        <h1 className="text-3xl font-semibold">Orders</h1>
        <p className="mt-3 text-red-600">
          Server error loading orders. Check Vercel logs.
        </p>
      </div>
    );
  }
}
