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

function normalizePhone(input: unknown): string {
  const s = String(input ?? "").trim();
  if (!s) throw new Error("Missing customerPhone");
  // Keep as user entered but strip double spaces
  return s.replace(/\s+/g, " ");
}

function normalizeEmail(input: unknown): string | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  return s;
}

/**
 * UK postcode normalization:
 * - uppercase
 * - remove spaces
 * - if length >= 5, insert a space before last 3 chars
 *   e.g. "BA98BW" -> "BA9 8BW"
 * - if too short/unknown, just uppercase + collapse spaces
 */
function normalizeUKPostcode(input: unknown): string {
  const raw = String(input ?? "").trim();
  if (!raw) throw new Error("Missing postcode");

  const noSpaces = raw.replace(/\s+/g, "").toUpperCase();

  // Typical UK postcodes are 5-7 chars without spaces.
  if (noSpaces.length >= 5) {
    const outward = noSpaces.slice(0, -3);
    const inward = noSpaces.slice(-3);
    return `${outward} ${inward}`;
  }

  // Fallback: keep readable
  return raw.toUpperCase().replace(/\s+/g, " ");
}

function normalizeName(input: unknown): string {
  const s = String(input ?? "").trim();
  if (!s) throw new Error("Missing customerName");
  return s.replace(/\s+/g, " ");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const proofTag = `vercel-proof-${new Date().toISOString()}`;

    const body: any = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const rawItems: any[] =
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

    const items: NormalizedItem[] = rawItems.map((i: any, idx: number) => {
      const productId = String(i?.productId ?? "").trim();
      const name = String(i?.name ?? "").trim();

      if (!productId) throw new Error(`Item ${idx + 1}: missing productId`);
      if (!name) throw new Error(`Item ${idx + 1}: missing name`);

      const quantity = toPositiveInt(i?.quantity ?? i?.qty, "quantity");

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

    const totalPence = items.reduce<number>((sum, i) => sum + i.pricePence * i.quantity, 0);

    // Normalize customer fields
    const customerName = body?.customerName ? normalizeName(body.customerName) : "Vercel Proof";
    const customerPhone = body?.customerPhone ? normalizePhone(body.customerPhone) : "07000000000";
    const customerEmail = normalizeEmail(body?.customerEmail);
    const postcode = body?.postcode ? normalizeUKPostcode(body.postcode) : "TA1 1AA";

    const order = await prisma.order.create({
      data: {
        customerName,
        customerPhone,
        customerEmail,
        postcode,
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
      postcode: order.postcode,
      itemCount: order.items.length,
    });
  } catch (err: any) {
    console.error("POST /api/orders failed:", err);
    return res.status(400).json({ ok: false, message: err?.message ?? String(err) });
  }
}
