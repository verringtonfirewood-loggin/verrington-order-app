import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const proofTag = `vercel-proof-${new Date().toISOString()}`;
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // If you POST real items later, we’ll use them; otherwise create a dummy proof item
    const items =
      Array.isArray(body?.items) && body.items.length > 0
        ? body.items
        : [
            {
              productId: "proof-product",
              name: `Proof Item (${proofTag})`,
              pricePence: 1234,
              quantity: 1,
            },
          ];

    const totalPence = items.reduce(
      (sum: number, i: any) => sum + Number(i.pricePence) * Number(i.quantity),
      0
    );

    const order = await prisma.order.create({
      data: {
        customerName: body?.customerName ?? "Vercel Proof",
        customerPhone: body?.customerPhone ?? "07000000000",
        customerEmail: body?.customerEmail ?? null,
        postcode: body?.postcode ?? "TA1 1AA",
        totalPence,
        status: "pending",
        items: {
          create: items.map((i: any) => ({
            productId: String(i.productId),
            name: String(i.name),
            pricePence: Number(i.pricePence),
            quantity: Number(i.quantity),
          })),
        },
      },
      include: { items: true },
    });

    return res.status(201).json({
      ok: true,
      proofTag,
      orderId: order.id,
      createdAt: order.createdAt,
      totalPence: order.totalPence,
      itemCount: order.items.length,
    });
  } catch (err: any) {
    console.error("POST /api/orders failed:", err);
    return res.status(500).json({ ok: false, message: err?.message ?? String(err) });
  }
}
