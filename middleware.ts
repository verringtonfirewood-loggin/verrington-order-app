// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Admin"',
    },
  });
}

function parseUsersEnv(raw: string): Record<string, string> {
  // Supports separators: newline, semicolon, comma
  // Also strips Windows CR chars and trims spaces
  const cleaned = raw.replace(/\r/g, "").trim();
  if (!cleaned) return {};

  const parts = cleaned
    .split(/[\n;,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const map: Record<string, string> = {};
  for (const p of parts) {
    const idx = p.indexOf(":");
    if (idx === -1) continue;
    const u = p.slice(0, idx).trim();
    const pw = p.slice(idx + 1).trim();
    if (!u) continue;
    map[u] = pw;
  }
  return map;
}

export function middleware(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Basic ")) return unauthorized();

  let user = "";
  let pass = "";

  try {
    const decoded = atob(auth.slice("Basic ".length));
    const idx = decoded.indexOf(":");
    if (idx === -1) return unauthorized();
    user = decoded.slice(0, idx);
    pass = decoded.slice(idx + 1);
  } catch {
    return unauthorized();
  }

  // Prefer ADMIN_USERS if present
  const usersEnv = process.env.ADMIN_USERS;
  if (usersEnv && usersEnv.trim()) {
    const users = parseUsersEnv(usersEnv);
    const expected = users[user];
    if (!expected) return unauthorized();
    if (pass !== expected) return unauthorized();
    return NextResponse.next();
  }

  // Legacy fallback
  const legacyUser = process.env.ADMIN_USER || "";
  const legacyPass = process.env.ADMIN_PASS || "";
  if (!legacyUser || !legacyPass) return unauthorized();

  if (user !== legacyUser || pass !== legacyPass) return unauthorized();
  return NextResponse.next();
}