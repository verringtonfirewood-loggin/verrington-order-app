import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*"],
};

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Admin"',
    },
  });
}

function parseBasicAuth(authHeader: string) {
  if (!authHeader.startsWith("Basic ")) return null;

  try {
    const b64 = authHeader.slice("Basic ".length).trim();
    const decoded = atob(b64);
    const idx = decoded.indexOf(":");
    if (idx === -1) return null;

    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    return { user, pass };
  } catch {
    return null;
  }
}

function buildAllowedUsersFromEnv(): Record<string, string> {
  // Preferred: ADMIN_USERS="mike:pass,admin:pass2"
  const raw = (process.env.ADMIN_USERS ?? "").trim();
  const map: Record<string, string> = {};

  if (raw) {
    for (const entry of raw.split(",")) {
      const e = entry.trim();
      if (!e) continue;

      const idx = e.indexOf(":");
      if (idx === -1) continue;

      const u = e.slice(0, idx).trim();
      const p = e.slice(idx + 1).trim();

      if (u && p) map[u] = p;
    }
  }

  // Back-compat: ADMIN_USER + ADMIN_PASS
  const legacyUser = (process.env.ADMIN_USER ?? "").trim();
  const legacyPass = (process.env.ADMIN_PASS ?? "").trim();
  if (legacyUser && legacyPass && !map[legacyUser]) {
    map[legacyUser] = legacyPass;
  }

  return map;
}

export function middleware(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) return unauthorized();

  const parsed = parseBasicAuth(auth);
  if (!parsed) return unauthorized();

  const allowed = buildAllowedUsersFromEnv();

  // Safety: if nothing configured, always block (prevents accidental open admin)
  if (Object.keys(allowed).length === 0) {
    return unauthorized();
  }

  const expected = allowed[parsed.user];
  if (!expected || parsed.pass !== expected) {
    return unauthorized();
  }

  return NextResponse.next();
}