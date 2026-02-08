import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

type NormalizedItem = {
  productId: string;
  name: string;
  pricePence: number;
  quantity: number;
};

/**
 * Convert a GBP amount (e.g. "9.50", 9.5, "£9.50") to integer pence.
 * Throws on invalid values.
 */
function gbpToPence(input: unknown): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new Error("Invalid price");
    return Math.round(input * 100);
  }

  if (typeof input === "string") {
    const cleaned = input
      .trim()
      .replaceAll("£", "")
      .replaceAll(",", ".")
      .replaceAll(" ", "");

    if (cleaned === "") throw new Error("Invalid price");

    const asNumber = Number(cleaned);
    if (!Number.isFinite(asNumber)) throw new Error("Invalid price");

    return Math.round(asNumber * 100);
  }

  throw new Error("Invalid price");
}

function toPositiveInt(input: unknown, fieldName: string): number {
  const n = Number(input);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid ${fieldName}`);
  return n;
}

function toNonNegativeInt(input: unknown, fieldName: string): number {
  const n = Number(input);
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid ${fieldName}`);
  return n;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const proofTag = `vercel-proof-${new Date().toISOString()}`;

    // Next.js usually parses JSON automatically, but keep safe parse for robustness:
    const body: any = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // If you POST real items, we’ll use them; otherwise create a dummy proof item
    const rawItems: any[] =
      Array.isArray(body?.items) && body.items.length > 0
        ? body.items
        : [
            {
              productId: "proof-product",
              name: `Proof Item (${proofTag})`,
              // proof item can be either pricePence or price (GBP) — both supported
              pricePence: 1234,
              quantity: 1,
            },
          ];

    // Normalize items:
    // - REQUIRE: productId, name, quantity
    // - ACCEPT: price (GBP) OR priceGbp (GBP) OR pricePence (int)
    const items: NormalizedItem[] = rawItems.map((i: any, idx: number) => {
      const productId = String(i?.productId ?? "").trim();
      const name = String(i?.name ?? "").trim();

      if (!productId) throw new Error(`Item ${idx + 1}: missing productId`);
      if (!name) throw new Error(`Item ${idx + 1}: missing name`);

      const quantity = toPositiveInt(i?.quantity ?? i?.qty, "quantity");

      // Backwards compatible: if pricePence is provided and valid, use it.
      // Otherwise, accept GBP fields from the frontend and convert to pence.
      let pricePence: number;

      if (i?.pricePence !== undefined && i?.pricePence !== null && i?.pricePence !== "") {
        pricePence = toNonNegativeInt(i.pricePence, "pricePence");
      } else {
        const gbp = i?.price ?? i?.priceGbp ?? i?.unitPrice ?? i?.unitPriceGbp;
        if (gbp === undefined || gbp === null || gbp === "") {
          throw new Error(`Item ${idx + 1}: missing price`);
        }
        pricePence = gbpToPence(gbp);
      }

      return { productId, name, pricePence, quantity };
    });

    // Compute total server-side (authoritative)
    const totalPence = items.reduce<number>((sum, i) => sum + i.pricePence * i.quantity, 0);

    const order = await prisma.order.create({
      data: {
        customerName: body?.customerName ?? "Vercel Proof",
        customerPhone: body?.customerPhone ?? "07000000000",
        customerEmail: body?.customerEmail ?? null,
        postcode: body?.postcode ?? "TA1 1AA",
        totalPence,
        status: body?.status ?? "pending",
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            pricePence: i.pricePence,
            quantity: i.quantity,
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
    return res.status(400).json({ ok: false, message: err?.message ?? String(err) });
  }
}
