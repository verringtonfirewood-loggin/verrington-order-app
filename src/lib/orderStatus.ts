export const ALLOWED_STATUSES = [
  "pending",
  "confirmed",
  "paid",
  "out-for-delivery",
  "delivered",
  "cancelled",
] as const;

export type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

export function isAllowedStatus(s: unknown): s is AllowedStatus {
  return typeof s === "string" && (ALLOWED_STATUSES as readonly string[]).includes(s);
}
