import type { NextApiRequest, NextApiResponse } from "next";
import { isAuthed, unauthorized } from "@/lib/adminAuth";
import { isAllowedStatus } from "@/lib/orderStatus";
import { getPrisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer"; // adjust if your function name differs

export const config = { runtime: "nodejs" };

function getAppBaseUrl() {
  const explicit = process.env.APP_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`.replace(/\/+$/, "");

  return "http://localhost:3000";
}

function esc(s: unknown) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthed(req)) return unauthorized(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ ok: false, error: "Missing order id" });

  const status = req.body?.status;
  if (!isAllowedStatus(status)) {
    return res.status(400).json({ ok: false, error: "Invalid status" });
  }

  try {
    const prisma = await getPrisma();

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        status: true,
        orderNumber: true,
        customerEmail: true,
        customerName: true,
      },
    });

    let emailed = false;

    if (order.customerEmail) {
      const baseUrl = getAppBaseUrl();
      const orderRef = esc(order.orderNumber ?? order.id);

      const subject = `Order Update – ${orderRef}`;

      const html = `
        <div style="font-family: system-ui, sans-serif; line-height:1.5">
          <h2>Order Update</h2>
          <p>Hello ${esc(order.customerName)},</p>
          <p>Your order <strong>${orderRef}</strong> status is now:</p>
          <p style="font-size:18px;"><strong>${esc(order.status)}</strong></p>
          <p>You can view your order here:</p>
          <p>
            <a href="${baseUrl}/order/${order.id}">
              ${baseUrl}/order/${order.id}
            </a>
          </p>
          <p>Thank you,<br/>Verrington Firewood</p>
        </div>
      `;

      await sendEmail({
        to: order.customerEmail,
        subject,
        html,
      });

      emailed = true;
    }

    return res.status(200).json({
      ok: true,
      order,
      emailed,
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message ?? "Internal Server Error",
    });
  }
}
