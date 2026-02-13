import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
  });
}

function envAdminUser() {
  return (
    process.env.ADMIN_USER ||
    process.env.BASIC_AUTH_USER ||
    process.env.VF_ADMIN_USER ||
    ""
  );
}

function envAdminPass() {
  return (
    process.env.ADMIN_PASS ||
    process.env.BASIC_AUTH_PASS ||
    process.env.VF_ADMIN_PASS ||
    ""
  );
}

function decodeBasic(auth: string) {
  const b64 = auth.slice("Basic ".length).trim();
  // Node runtime: Buffer is available
  return Buffer.from(b64, "base64").toString("utf8");
}

function checkBasicAuth(req: Request) {
  const user = envAdminUser();
  const pass = envAdminPass();
  if (!user || !pass) return false;

  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) return false;

  const decoded = decodeBasic(auth);
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;

  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);
  return u === user && p === pass;
}

// POST /api/admin/seed-products
export async function POST(req: Request) {
  if (!checkBasicAuth(req)) return unauthorized();

  const prisma = getPrisma();

  const defaults = [
    {
      name: "Net of Logs",
      description: "Perfect for occasional fires. Easy to store and handle.",
      pricePence: 2000,
      sortOrder: 10,
      isActive: true,
    },
    {
      name: "Bulk Bag of Logs",
      description: "Best value for regular burners. Seasoned hardwood.",
      pricePence: 10000,
      sortOrder: 20,
      isActive: true,
    },
    {
      name: "IBC Crate",
      description: "A full IBC crate of loose-tipped, fully seasoned logs.",
      pricePence: 19500,
      sortOrder: 30,
      isActive: true,
    },
  ];

  const created: string[] = [];
  const existed: string[] = [];

  for (const p of defaults) {
    const existing = await prisma.product.findFirst({
      where: { name: p.name },
      select: { id: true },
    });

    if (existing) {
      existed.push(p.name);
      continue;
    }

    await prisma.product.create({ data: p });
    created.push(p.name);
  }

  const total = await prisma.product.count();

  return NextResponse.json({ ok: true, created, existed, total });
}
