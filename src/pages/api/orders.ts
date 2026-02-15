import type { NextApiRequest, NextApiResponse } from "next";
import { getPrisma } from "@/lib/prisma";
import {
  sendAdminNewOrderEmail,
  sendCustomerConfirmationEmail,
} from "@/lib/mailer";

function toPositiveInt(input: unknown, fieldName: string): number {
  const n = Number(input);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid ${fieldName}`);
  return n;
}

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

function cleanOptionalString(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  return s ? s : null;
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

    // Core fields
    const postcode = normalizeUKPostcode(body?.postcode ?? "TA1 1AA");
    const checkoutPaymentMethod = parseCheckoutPaymentMethod(body?.checkoutPaymentMethod);

    // Optional fields
    const preferredDay = cleanOptionalString(body?.preferredDay);
    const deliveryNotes = cleanOptionalString(body?.deliveryNotes);

    // NEW: Address fields (manual entry)
    const addressLine1 = cleanOptionalString(body?.addressLine1);
    const addressLine2 = cleanOptionalString(body?.addressLine2);
    const town = cleanOptionalString(body?.town);
    const county = cleanOptionalString(body?.county);

    // Items
    const hasRealItems = Array.isArray(body?.items) && body.items.length > 0;

    const rawItems: any[] = hasRealItems
      ? body.items
      : [
          {
            productId: "proof-product",
            name: `Proof Item (${proofTag})`,
            quantity: 1,
          },
        ];

    const requested: RequestedItem[] = rawItems.map((i: any, idx: number) => {
      const productId = String(i?.productId ?? "").trim();
      if (!productId) throw new Error(`Item ${idx + 1}: missing productId`);

      const quantity = toPositiveInt(i?.quantity ?? i?.qty, "quantity");
      return { productId, quantity };
    });

    let itemCreates: ItemCreate[] = [];

    if (hasRealItems) {
      const productIds = Array.from(new Set(requested.map((r) => r.productId)));

      const dbProducts = await prisma.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true, name: true, pricePence: true },
      });

      const productMap = new Map(dbProducts.map((p) => [p.id, p]));

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
      itemCreates = [
        {
          productId: "proof-product",
          name: `Proof Item (${proofTag})`,
          pricePence: 1234,
          quantity: 1,
        },
      ];
    }

    const subtotalPence = itemCreates.reduce((sum, i) => sum + i.pricePence * i.quantity, 0);
    const deliveryFeePence = deliveryFeeForPostcodePence(postcode);
    const totalPence = subtotalPence + deliveryFeePence;

    const paymentStatus = checkoutPaymentMethod === "MOLLIE" ? "PENDING" : "UNPAID";

    // ✅ VF-ORDER-### generation (transaction safe)
    const order = await prisma.$transaction(async (tx) => {
      const counter = await tx.orderCounter.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, next: 1 },
      });

      const n = counter.next;

      await tx.orderCounter.update({
        where: { id: 1 },
        data: { next: { increment: 1 } },
      });

      const orderNumber = `VF-ORDER-${String(n).padStart(3, "0")}`;

      return tx.order.create({
        data: {
          orderNumber,

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

          // NEW address fields (nullable in DB)
          addressLine1,
          addressLine2,
          town,
          county,

          postcode,
          subtotalPence,
          deliveryFeePence,
          totalPence,
          preferredDay,
          deliveryNotes,

          status:
            typeof body?.status === "string" && body.status.trim()
              ? body.status.trim()
              : "NEW",

          checkoutPaymentMethod,
          paymentStatus,

          items: {
            create: itemCreates.map((i) => ({
              productId: i.productId,
              name: i.name,
              pricePence: i.pricePence,
              quantity: i.quantity,
              lineTotalPence: i.pricePence * i.quantity,
            })),
          },
        },
        include: { items: true },
      });
    });

    // ✅ Send emails AFTER the transaction succeeds
    try {
      const adminEmailArgs = {
        orderId: order.id,
        createdAt: order.createdAt.toISOString(),
        customerName: order.customerName,
        customerPhone: order.customerPhone ?? undefined,
        customerEmail: order.customerEmail ?? null,
        postcode: order.postcode ?? null,

        // NEW: include address in admin email payload (safe optional)
        addressLine1: order.addressLine1 ?? null,
        addressLine2: order.addressLine2 ?? null,
        town: order.town ?? null,
        county: order.county ?? null,

        totalPence: order.totalPence ?? null,
        status: order.status ?? undefined,
        items: (order.items ?? []).map((it) => ({
          name: it.name,
          quantity: it.quantity,
          pricePence: it.pricePence ?? null,
        })),
      };

      const tasks: Promise<any>[] = [];

      // Admin email (requires ADMIN_NOTIFY_TO env var)
      tasks.push(sendAdminNewOrderEmail(adminEmailArgs as any));

      // Customer email (only if enabled + we have an email)
      if (String(process.env.SEND_CUSTOMER_EMAIL || "false") === "true" && order.customerEmail) {
        const customerEmailArgs = {
          to: order.customerEmail,
          orderId: order.id,
          customerName: order.customerName,
          postcode: order.postcode ?? undefined,
          totalPence: order.totalPence ?? undefined,
          items: (order.items ?? []).map((it) => ({
            name: it.name,
            quantity: it.quantity,
          })),
        };

        tasks.push(sendCustomerConfirmationEmail(customerEmailArgs as any));
      }

      await Promise.allSettled(tasks);
    } catch (e) {
      console.error("[orders] email error:", e);
    }

    return res.status(201).json({
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      subtotalPence,
      deliveryFeePence,
      totalPence,
      checkoutPaymentMethod,
      paymentStatus,
    });
  } catch (err: any) {
    console.error("POST /api/orders failed:", err);
    return res.status(400).json({ ok: false, message: err?.message ?? String(err) });
  }
}
