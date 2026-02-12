import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { sendCustomerStatusUpdateEmail } from "@/lib/mailer";
import type { OrderStatus } from "@prisma/client";

const ALLOWED_STATUSES = [
  "pending",
  "confirmed",
  "paid",
  "out-for-delivery",
  "delivered",
  "cancelled",
] as const satisfies readonly OrderStatus[];

const ALLOWED_STATUS_SET = new Set<OrderStatus>(ALLOWED_STATUSES);

function isAllowedStatus(s: unknown): s is OrderStatus {
  return typeof s === "string" && ALLOWED_STATUS_SET.has(s as OrderStatus);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid order id" });
  }

  // ---------------- GET ----------------
  if (req.method === "GET") {
    try {
      const order = await prisma.order.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      return res.status(200).json(order);
    } catch (err) {
      console.error("GET /api/admin/orders/[id] failed:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }

  // ---------------- PATCH ----------------
  if (req.method === "PATCH") {
    try {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;

      const nextStatus = body?.status;

      if (!isAllowedStatus(nextStatus)) {
        return res.status(400).json({
          error: "Invalid status",
          allowed: ALLOWED_STATUSES,
        });
      }

      const existing = await prisma.order.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          customerEmail: true,
          customerName: true,
          postcode: true,
        },
      });

      if (!existing) {
        return res.status(404).json({ error: "Order not found" });
      }

      const updated = await prisma.order.update({
        where: { id },
        data: { status: nextStatus },
        include: { items: true },
      });

      // ---- CUSTOMER STATUS EMAIL (filtered + safe) ----
      const EMAIL_STATUSES = new Set([
        "paid",
        "out-for-delivery",
        "delivered",
        "cancelled",
      ]);

      const adminEmails = new Set(
        [
          process.env.ADMIN_NOTIFY_TO,
          process.env.SMTP_USER,
          "hello@verringtonfirewood.co.uk",
          "verringtonfirewood@gmail.com",
        ]
          .filter(Boolean)
          .map((e) => String(e).toLowerCase())
      );

      const customerEmail = String(existing.customerEmail || "").toLowerCase();

      const shouldEmailCustomer =
        String(process.env.SEND_CUSTOMER_EMAIL || "false") === "true" &&
        !!existing.customerEmail &&
        String(existing.status) !== String(nextStatus) &&
        EMAIL_STATUSES.has(String(nextStatus)) &&
        !adminEmails.has(customerEmail);

      if (shouldEmailCustomer) {
        try {
          await sendCustomerStatusUpdateEmail({
            to: existing.customerEmail!,
            orderId: existing.id,
            customerName: existing.customerName ?? undefined,
            postcode: existing.postcode ?? undefined,
            status: String(nextStatus),
          });
        } catch (e) {
          console.error("Customer status email failed:", e);
        }
      }
      // ---- END CUSTOMER STATUS EMAIL ----

      return res.status(200).json({ ok: true, order: updated });
    } catch (err: any) {
      console.error("PATCH /api/admin/orders/[id] failed:", err);
      return res.status(500).json({ error: err?.message ?? "Server error" });
    }
  }

  // ---------------- METHOD NOT ALLOWED ----------------
  res.setHeader("Allow", ["GET", "PATCH"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
