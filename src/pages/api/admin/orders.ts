import type { NextApiRequest, NextApiResponse } from "next";
import { getPrisma } from "@/lib/prisma";

/**
 * Inline Basic Auth for admin APIs.
 * We keep this in the API route (Node runtime) to avoid Edge/middleware pitfalls.
 */
function requireBasicAuth(req: NextApiRequest, res: NextApiResponse): boolean {
  const expectedUser = process.env.ADMIN_USER ?? "";
  const expectedPass = process.env.ADMIN_PASS ?? "";

  // If creds are not configured, fail closed.
  if (!expectedUser || !expectedPass) {
    console.error("ADMIN_USER/ADMIN_PASS not set");
    res.status(500).json({ ok: false, message: "Admin credentials not configured" });
    return false;
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
    res.status(401).send("Unauthorized");
    return false;
  }

  let user = "";
  let pass = "";

  try {
    const b64 = auth.slice("Basic ".length).trim();
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx === -1) throw new Error("Invalid basic auth format");
    user = decoded.slice(0, idx);
    pass = decoded.slice(idx + 1);
  } catch (e) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
    res.status(401).send("Unauthorized");
    return false;
  }

  if (user !== expectedUser || pass !== expectedPass) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
    res.status(401).send("Unauthorized");
    return false;
  }

  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // No caching for admin data
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });
  }

  // ✅ Inline auth (do this BEFORE any DB/prisma work)
  if (!requireBasicAuth(req, res)) return;

  try {
    const takeRaw = typeof req.query.take === "string" ? Number(req.query.take) : NaN;
    const take = Number.isFinite(takeRaw)
      ? Math.max(1, Math.min(200, Math.trunc(takeRaw)))
      : 50;

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
      where.OR = [
        { customerName: { contains: q } },
        { customerPhone: { contains: q } },
        { customerEmail: { contains: q } },
        { postcode: { contains: q } },
        { id: { contains: q } },
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
    return res.status(500).json({ ok: false, message: err?.message ?? String(err) });
  }
}
