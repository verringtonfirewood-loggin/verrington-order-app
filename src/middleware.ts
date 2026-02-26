import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*"],
};

function parseAdminUsers(raw: string) {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf(":");
      if (idx <= 0) return null;

      const user = pair.slice(0, idx).trim();
      const pass = pair.slice(idx + 1).trim();

      if (!user || !pass) return null;

      return { user, pass };
    })
    .filter(Boolean) as { user: string; pass: string }[];
}

function isAllowedAdmin(user: string, pass: string) {
  const multi = process.env.ADMIN_USERS?.trim();

  // ✅ Preferred: multi-user mode
  if (multi) {
    const allowed = parseAdminUsers(multi);
    return allowed.some((a) => a.user === user && a.pass === pass);
  }

  // ✅ Fallback: existing single-user mode
  return (
    user === process.env.ADMIN_USER &&
    pass === process.env.ADMIN_PASS
  );
}

export function middleware(req: NextRequest) {
  const auth = req.headers.get("authorization");

  if (!auth || !auth.startsWith("Basic ")) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Admin"',
      },
    });
  }

  let user = "";
  let pass = "";

  try {
    const decoded = atob(auth.slice("Basic ".length));
    const idx = decoded.indexOf(":");

    if (idx === -1) throw new Error("Invalid auth format");

    user = decoded.slice(0, idx);
    pass = decoded.slice(idx + 1);
  } catch {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Admin"',
      },
    });
  }

  if (!isAllowedAdmin(user, pass)) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Admin"',
      },
    });
  }

  return NextResponse.next();
}