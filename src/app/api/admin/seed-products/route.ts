import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

function checkBasicAuth(req: Request) {
  const user = envAdminUser();
  const pass = envAdminPass();
  if (!user || !pass) return false;

  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) return false;

  const b64 = auth.slice("Basic ".length).trim();
  const decoded = Buffer.from(b64, "base64").toString("utf8");
  const [u, p] = decoded.split(":");
  return u === user && p === pass;
}

// POST /api/admin/seed-products
export async function POST(req: Request) {
  if (!checkBasicAuth(req)) return unauthorized();

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

  return NextResponse.json({
    ok: true,
    created,
    existed,
    total,
  });
}
