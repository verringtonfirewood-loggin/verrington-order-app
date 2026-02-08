 import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const ALLOWED_STATUSES = [
  "pending",
  "confirmed",
  "out-for-delivery",
  "delivered",
  "cancelled",
] as const;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function isAllowedStatus(s: unknown): s is AllowedStatus {
  return typeof s === "string" && (ALLOWED_STATUSES as readonly string[]).includes(s);
}

function unauthorized(res: NextApiResponse) {
  res.setHeader("WWW-Authenticate", 'Basic realm="Verrington Admin"');
  return res.status(401).json({ error: "Authentication required" });
}

function isAuthed(req: NextApiRequest): boolean {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;

  if (!user || !pass) return false;

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Basic ")) return false;

  const base64 = auth.slice("Basic ".length);

  let decoded = "";
  try {
    decoded = Buffer.from(base64, "base64").toString("utf8");
  } catch {
    return false;
  }

  const idx = decoded.indexOf(":");
  if (idx === -1) return false;

  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);

  return u === user && p === pass;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!id) return res.status(400).json({ error: "Missing order id" });

  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Self-protect the API
  if (!isAuthed(req)) {
    return unauthorized(res);
  }

  try {
    const body: any = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const status = body?.status;

    if (!isAllowedStatus(status)) {
      return res.status(400).json({
        error: "Invalid status",
        allowed: ALLOWED_STATUSES,
      });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    });

    return res.status(200).json({ ok: true, order: updated });
  } catch (err: any) {
    console.error("PATCH /api/admin/orders/[id] failed:", err);
    return res.status(500).json({ ok: false, message: err?.message ?? String(err) });
  }
}
