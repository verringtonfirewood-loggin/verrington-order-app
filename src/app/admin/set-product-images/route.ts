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

export async function POST(req: Request) {
  if (!checkBasicAuth(req)) return unauthorized();

  // Match by name (works with your seeded products)
  const updates = [
    { name: "Net of Logs", imageUrl: "/products/net.jpg", imageAlt: "Net of seasoned logs" },
    { name: "Bulk Bag of Logs", imageUrl: "/products/bulk-bag.jpg", imageAlt: "Bulk bag of seasoned logs" },
    { name: "IBC Crate", imageUrl: "/products/ibc-crate.jpg", imageAlt: "IBC crate of seasoned logs" },
  ];

  const results: any[] = [];

  for (const u of updates) {
    const r = await prisma.product.updateMany({
      where: { name: u.name },
      data: { imageUrl: u.imageUrl, imageAlt: u.imageAlt },
    });
    results.push({ name: u.name, updated: r.count });
  }

  return NextResponse.json({ ok: true, results });
}
