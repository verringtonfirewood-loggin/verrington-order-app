import type { NextApiRequest, NextApiResponse } from "next";
import { getPrisma } from "@/lib/prisma";
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

type RequestedItem = {
  productId: string;
  quantity: number;
};

type ItemCreate = {
  productId: string;
  name: string;
  pricePence: number;
  quantity: number;
};

type CheckoutPaymentMethod = "MOLLIE" | "BACS" | "CASH";

function parseBody(req: NextApiRequest): any {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body ?? null;
}

function parseCheckoutPaymentMethod(input: unknown): CheckoutPaymentMethod {
  const v = String(input ?? "").trim().toUpperCase();
  if (v === "MOLLIE" || v === "BACS" || v === "CASH") return v;
  return "BACS";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const prisma = await getPrisma();

    const proofTag = `vercel-proof-${new Date().toISOString()}`;
    const body = parseBody(req);
    if (!body) return res.status(400).json({ ok: false, message: "Invalid JSON body" });

    const postcode = normalizeUKPostcode(body?.postcode ?? "TA1 1AA");

    // ✅ Payment method saved on the order
    const checkoutPaymentMethod = parseCheckoutPaymentMethod(body?.checkoutPaymentMethod);

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
    const rawItems: any[] = hasRealItems
      ? body.items
      : [
          {
            productId: "proof-product",
            name: `Proof Item (${proofTag})`,
            quantity: 1,
          },
        ];

    // Validate incoming quantities + productIds
    const requested: RequestedItem[] = rawItems.map((i: any, idx: number): RequestedItem => {
      const productId = String(i?.productId ?? "").trim();
      if (!productId) throw new Error(`Item ${idx + 1}: missing productId`);

      const quantity = toPositiveInt(i?.quantity ?? i?.qty, "quantity");
      return { productId, quantity };
    });

    // ✅ Authoritative pricing:
    // For real orders, pull prices + names from DB by productId
    let itemCreates: ItemCreate[] = [];

    if (hasRealItems) {
      const productIds = Array.from(new Set(requested.map((r: RequestedItem) => r.productId)));

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

    // Totals computed from authoritative itemCreates
    const subtotalPence = itemCreates.reduce((sum, i) => sum + i.pricePence * i.quantity, 0);
    const deliveryFeePence = deliveryFeeForPostcodePence(postcode);
    const totalPence = subtotalPence + deliveryFeePence;

    // ✅ Payment status defaults:
    // - Mollie starts PENDING (webhook will flip to PAID/FAILED/etc)
    // - BACS/CASH start UNPAID
    const paymentStatus = checkoutPaymentMethod === "MOLLIE" ? "PENDING" : "UNPAID";

    const order = await prisma.order.create({
      data: {
        customerName:
          typeof body?.customerName === "string" && body.customerName.trim()
            ? body.customerName.trim()
            : "Vercel Proof",
        customerPhone:
          typeof body?.customerPhone === "string" && body.customerPhone.trim()
            ? body.customerPhone.trim()
            : "07000000000",
        customerEmail:
          typeof body?.customerEmail === "string" && body.customerEmail.trim()
            ? body.customerEmail.trim()
            : null,
        postcode,

        // ✅ totals stored (authoritative)
        subtotalPence,
        deliveryFeePence,
        totalPence,

        // ✅ extras stored
        preferredDay,
        deliveryNotes,

        // ✅ status standardised (keep your existing approach)
        status:
          typeof body?.status === "string" && body.status.trim()
            ? body.status.trim()
            : "NEW",

        // ✅ NEW: persisted payment choice + status
        checkoutPaymentMethod,
        paymentStatus,

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

          totalPence,
          status: order.status,

          items: (order.items || []).map((it: any) => ({
            name: it.name,
            quantity: it.quantity,
            pricePence: it.pricePence,
          })),

          // ok if your mailer ignores unknown fields
          subtotalPence,
          deliveryFeePence,
        } as any);

        if (String(process.env.SEND_CUSTOMER_EMAIL || "false") === "true" && order.customerEmail) {
          await sendCustomerConfirmationEmail({
            to: order.customerEmail,
            orderId: order.id,
            customerName: order.customerName,
            postcode: order.postcode,

            totalPence,

            items: (order.items || []).map((it: any) => ({
              name: it.name,
              quantity: it.quantity,
            })),

            // ok if your mailer ignores unknown fields
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

      subtotalPence,
      deliveryFeePence,
      totalPence,

      postcode: order.postcode,
      itemCount: order.items.length,

      // helpful for UI / debugging
      checkoutPaymentMethod,
      paymentStatus,
    });
  } catch (err: any) {
    console.error("POST /api/orders failed:", err);
    return res.status(400).json({ ok: false, message: err?.message ?? String(err) });
  }
}
