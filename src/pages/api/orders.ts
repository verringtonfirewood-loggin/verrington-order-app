import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { sendAdminNewOrderEmail, sendCustomerConfirmationEmail } from "@/lib/mailer";

function toPositiveInt(input: unknown, fieldName: string): number {
  const n = Number(input);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid ${fieldName}`);
  return n;
}

/**
 * UK postcode normalization:
 * - trim
 * - uppercase
 * - remove all spaces
 * - if length >= 5, insert a space before the last 3 chars
 *   e.g. "BA98BW" -> "BA9 8BW"
 * - fallback: collapse whitespace + uppercase
 */
function normalizeUKPostcode(input: unknown): string {
  const raw = String(input ?? "").trim();
  if (!raw) throw new Error("Missing postcode");

  const compact = raw.replace(/\s+/g, "").toUpperCase();

  if (compact.length >= 5) {
    const outward = compact.slice(0, -3);
    const inward = compact.slice(-3);
    return `${outward} ${inward}`;
  }

  return raw.toUpperCase().replace(/\s+/g, " ");
}

/**
 * ✅ Delivery pricing bands (edit values to match your business rules)
 * This is authoritative and computed server-side.
 */
function deliveryFeeForPostcodePence(postcode: string): number {
  const outward = (postcode.split(" ")[0] || "").toUpperCase();

  if (outward.startsWith("BA9")) return 0;
  if (outward.startsWith("BA")) return 500;
  if (outward.startsWith("DT")) return 800;
  if (outward.startsWith("SP")) return 800;
  if (outward.startsWith("TA")) return 1000;

  return 1500;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const proofTag = `vercel-proof-${new Date().toISOString()}`;
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const postcode = normalizeUKPostcode(body?.postcode ?? "TA1 1AA");

    // Optional extras from your UI (safe strings)
    const preferredDay =
      typeof body?.preferredDay === "string" && body.preferredDay.trim()
        ? body.preferredDay.trim()
        : null;

    const deliveryNotes =
      typeof body?.deliveryNotes === "string" && body.deliveryNotes.trim()
        ? body.deliveryNotes.trim()
        : null;

    const hasRealItems = Array.isArray(body?.items) && body.items.length > 0;

    // Proof fallback if no items provided
    const rawItems = hasRealItems
      ? body.items
      : [
          {
            productId: "proof-product",
            name: `Proof Item (${proofTag})`,
            quantity: 1,
          },
        ];

    // Validate incoming quantities + productIds
    const requested = rawItems.map((i: any, idx: number) => {
      const productId = String(i?.productId ?? "").trim();
      if (!productId) throw new Error(`Item ${idx + 1}: missing productId`);

      const quantity = toPositiveInt(i?.quantity ?? i?.qty, "quantity");
      return { productId, quantity };
    });

    // ✅ Authoritative pricing:
    // For real orders, pull prices + names from DB by productId
    let itemCreates: Array<{ productId: string; name: string; pricePence: number; quantity: number }> = [];

    if (hasRealItems) {
      const productIds = Array.from(new Set(requested.map((r) => r.productId)));

      const dbProducts = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          isActive: true,
        },
        select: { id: true, name: true, pricePence: true },
      });

      const productMap = new Map(dbProducts.map((p) => [p.id, p]));

      // Ensure all productIds exist + active
      for (const r of requested) {
        if (!productMap.has(r.productId)) {
          throw new Error(`Unknown or inactive product: ${r.productId}`);
        }
      }

      itemCreates = requested.map((r) => {
        const p = productMap.get(r.productId)!;
        return {
          productId: p.id,
          name: p.name,
          pricePence: p.pricePence,
          quantity: r.quantity,
        };
      });
    } else {
      // Proof order: keep deterministic values
      itemCreates = [
        {
          productId: "proof-product",
          name: `Proof Item (${proofTag})`,
          pricePence: 1234,
          quantity: 1,
        },
      ];
    }

const subtotalPence = items.reduce((sum: number, i: any) => sum + i.pricePence * i.quantity, 0);
const deliveryFeePence = deliveryFeeForPostcodePence(postcode);
const totalPence = subtotalPence + deliveryFeePence;

    const order = await prisma.order.create({
      data: {
        customerName: body?.customerName ?? "Vercel Proof",
        customerPhone: body?.customerPhone ?? "07000000000",
        customerEmail: body?.customerEmail ?? null,
        postcode,

        // ✅ totals stored (authoritative)
		subtotalPence,
		deliveryFeePence,
		totalPence,
		preferredDay: body?.preferredDay ?? null,
		deliveryNotes: body?.deliveryNotes ?? null,

        // ✅ extras
        preferredDay,
        deliveryNotes,

        // ✅ status standardised
        status: body?.status ?? "NEW",

        items: {
          create: itemCreates.map((i) => ({
            productId: i.productId,
            name: i.name,
            pricePence: i.pricePence,
            quantity: i.quantity,
          })),
        },
      },
      include: { items: true },
    });

    const isProofOrder = !hasRealItems;

    if (!isProofOrder) {
      try {
        await sendAdminNewOrderEmail({
          orderId: order.id,
          createdAt: order.createdAt.toISOString(),
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerEmail: order.customerEmail ?? undefined,
          postcode: order.postcode,

          // ✅ include all totals
          totalPence: (order as any).totalPence ?? totalPence,
          status: order.status,

          items: (order.items || []).map((it: any) => ({
            name: it.name,
            quantity: it.quantity,
            pricePence: it.pricePence,
          })),

          // harmless if your mailer ignores unknown fields
          subtotalPence,
          deliveryFeePence,
        } as any);

        if (String(process.env.SEND_CUSTOMER_EMAIL || "false") === "true" && order.customerEmail) {
          await sendCustomerConfirmationEmail({
            to: order.customerEmail,
            orderId: order.id,
            customerName: order.customerName,
            postcode: order.postcode,

            // ✅ customer gets proper total
            totalPence: (order as any).totalPence ?? totalPence,

            items: (order.items || []).map((it: any) => ({
              name: it.name,
              quantity: it.quantity,
            })),

            // harmless if your mailer ignores unknown fields
            subtotalPence,
            deliveryFeePence,
          } as any);
        }
      } catch (e) {
        console.error("Email send failed:", e);
      }
    }

    return res.status(201).json({
      ok: true,
      proofTag,
      orderId: order.id,
      createdAt: order.createdAt,

      // ✅ return totals so UI can show instantly if needed
      subtotalPence,
      deliveryFeePence,
      totalPence,

      postcode: order.postcode,
      itemCount: order.items.length,
    });
  } catch (err: any) {
    console.error("POST /api/orders failed:", err);
    return res.status(400).json({ ok: false, message: err?.message ?? String(err) });
  }
}
