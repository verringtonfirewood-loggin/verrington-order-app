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
    decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }

  const idx = decoded.indexOf(":");
  if (idx === -1) return false;

  return (
    decoded.slice(0, idx) === user &&
    decoded.slice(idx + 1) === pass
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthed(req)) return unauthorized(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const take = Math.min(Number(req.query.take) || 50, 200);
    const status =
      typeof req.query.status === "string" && req.query.status.trim()
        ? req.query.status.trim()
        : null;

    const q =
      typeof req.query.q === "string" && req.query.q.trim()
        ? req.query.q.trim()
        : null;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (q) {
      where.OR = [
        { customerName: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q, mode: "insensitive" } },
        { customerEmail: { contains: q, mode: "insensitive" } },
        { postcode: { contains: q, mode: "insensitive" } },
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
    return res.status(500).json({
      ok: false,
      message: err?.message ?? String(err),
    });
  }
}
