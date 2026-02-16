// src/app/api/admin/orders/[id]/status/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";

const prisma = getPrisma();

const ALLOWED_STATUSES = new Set([
  "NEW",
  "CONFIRMED",
  "PAID",
  "OUT-FOR-DELIVERY",
  "DELIVERED",
]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const body = await request.json().catch(() => ({} as any));
  const status = String(body?.status ?? "").trim();

  if (!status) {
    return NextResponse.json({ ok: false, error: "Missing status" }, { status: 400 });
  }

  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
  }

  const order = await prisma.order.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders/selected");

  return NextResponse.json({ ok: true, order });
}
