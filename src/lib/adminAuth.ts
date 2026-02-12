import type { NextApiRequest, NextApiResponse } from "next";

export function unauthorized(res: NextApiResponse) {
  res.setHeader("WWW-Authenticate", 'Basic realm="Verrington Admin"');
  return res.status(401).json({ error: "Authentication required" });
}

export function isAuthed(req: NextApiRequest): boolean {
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
