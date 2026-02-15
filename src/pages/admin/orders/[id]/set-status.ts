import type { NextApiRequest, NextApiResponse } from "next";
import { isAuthed, unauthorized } from "@/lib/adminAuth";
import { isAllowedStatus } from "@/lib/orderStatus";
import { getPrisma } from "@/lib/prisma";
import { sendCustomerStatusUpdateEmail } from "@/lib/mailer";

export const config = {
  runtime: "nodejs",
};

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

    // Only email if we actually have an address
    if (order.customerEmail) {
      await sendCustomerStatusUpdateEmail({
        to: order.customerEmail,
        customerName: order.customerName,
        orderNumber: order.orderNumber ?? order.id,
        status: order.status,
        orderId: order.id,
      });
      emailed = true;
    }

    return res.status(200).json({ ok: true, order, emailed });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "Internal Server Error" });
  }
}
