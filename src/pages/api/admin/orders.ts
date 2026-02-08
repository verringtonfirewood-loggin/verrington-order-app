import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export const config = {
  runtime: "nodejs",
};

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

function parseIds(idsRaw: unknown): string[] {
  if (typeof idsRaw !== "string") return [];
  return idsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseDateISO(input: unknown): Date | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const d = new Date(input);
  return Number.isFinite(d.getTime()) ? d : null;
}

function normalizeSearch(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!isAuthed(req)) {
    return unauthorized(res);
  }

  try {
    const ids = parseIds(req.query.ids);
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";

    const from = parseDateISO(req.query.from);
    const to = parseDateISO(req.query.to);

    const q = normalizeSearch(req.query.q);

    const takeRaw = req.query.take;
    const take =
      typeof takeRaw === "string" && Number.isInteger(Number(takeRaw))
        ? Math.max(1, Math.min(200, Number(takeRaw)))
        : 50;

    const where: any = {};

    if (ids.length > 0) {
      where.id = { in: ids };
    }

    if (status) {
      where.status = status;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    if (q) {
      // MySQL: case-insensitive typically; Prisma uses contains -> LIKE %q%
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
      take: ids.length > 0 ? ids.length : take,
      include: { items: true },
    });

    return res.status(200).json({ ok: true, orders });
  } catch (err: any) {
    console.error("GET /api/admin/orders failed:", err);
    return res.status(500).json({ ok: false, message: err?.message ?? String(err) });
  }
}
