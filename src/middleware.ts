import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*"],
};

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

  if (
    user !== process.env.ADMIN_USER ||
    pass !== process.env.ADMIN_PASS
  ) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Admin"',
      },
    });
  }

  return NextResponse.next();
}
