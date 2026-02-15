import type { NextApiRequest, NextApiResponse } from "next";
import { isAuthed, unauthorized } from "@/lib/adminAuth";
import { ALLOWED_STATUSES } from "@/lib/orderStatus";

export const config = { runtime: "nodejs" };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthed(req)) return unauthorized(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  return res.status(200).json({ ok: true, statuses: ALLOWED_STATUSES });
}
