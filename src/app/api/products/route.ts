import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const rows = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({
      ok: true,
products: rows.map((p) => ({
  id: p.id,
  name: p.name,
  description: p.description ?? "",
  pricePence: p.pricePence,
  price: p.pricePence / 100,
  imageUrl: p.imageUrl ?? null,
  imageAlt: p.imageAlt ?? p.name,
})),
    });
  } catch (err) {
    console.error("GET /api/products failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load products" },
      { status: 500 }
    );
  }
}
