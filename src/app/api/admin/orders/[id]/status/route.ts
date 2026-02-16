// src/app/api/admin/orders/[id]/status/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const status = String(body.status ?? "").trim();

  if (!status) {
    return NextResponse.json(
      { ok: false, error: "Missing status" },
      { status: 400 }
    );
  }

  const order = await prisma.order.update({
    where: { id: params.id },
    data: { status },
  });

  // refresh everywhere that shows status pills
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${params.id}`);
  revalidatePath("/admin/orders/selected");

  return NextResponse.json({ ok: true, order });
}
