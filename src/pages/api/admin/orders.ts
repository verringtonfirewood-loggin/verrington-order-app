import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

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

  let decoded = "";
  try {
    decoded = Buffer.from(auth.slice("Basic ".length), "base64").toString("utf8");
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
  if (!isAuthed(req)) return unauthorized(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const takeRaw = typeof req.query.take === "string" ? Number(req.query.take) : NaN;
    const take = Number.isFinite(takeRaw) ? Math.max(1, Math.min(200, Math.trunc(takeRaw))) : 50;

    const status =
      typeof req.query.status === "string" && req.query.status.trim()
        ? req.query.status.trim()
        : null;

    const q =
      typeof req.query.q === "string" && req.query.q.trim()
        ? req.query.q.trim()
        : null;

    const where: any = {};

    if (status) where.status = status;

    if (q) {
      // NOTE: For MySQL, don't use mode:"insensitive" (often unsupported).
      // Most MySQL setups are already case-insensitive due to collation.
      where.OR = [
        { customerName: { contains: q } },
        { customerPhone: { contains: q } },
        { customerEmail: { contains: q } },
        { postcode: { contains: q } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: { items: true },
    });

    return res.status(200).json({ ok: true, orders });
  } catch (err: any) {
    console.error("GET /api/admin/orders failed:", err);
    // Return message to speed debugging if anything else crops up
    return res.status(500).json({ ok: false, message: err?.message ?? String(err) });
  }
}
