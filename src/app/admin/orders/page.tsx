// app/admin/orders/page.tsx
import prisma from "@/lib/prisma";
import OrdersTableClient from "./OrdersTableClient";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: true }, // 🔁 rename if needed
  });

  return (
    <div className="p-6">
      <h1 className="text-3xl font-semibold">Orders ({orders.length})</h1>

      <div className="mt-6">
        <OrdersTableClient orders={orders as any} />
      </div>
    </div>
  );
}
