// src/lib/orderRef.ts

export type OrderRefInput = {
  id: string;
  orderNumber?: string | null;
};

/**
 * Returns a safe, customer-friendly order reference.
 * Prefers stored orderNumber (e.g. VF-ORDER-012).
 * Falls back to a stable short ref if missing/malformed.
 */
export function getOrderRef(order: OrderRefInput): string {
  const raw = (order.orderNumber ?? "").trim();

  // Ideal format
  if (/^VF-ORDER-\d+$/i.test(raw)) return raw.toUpperCase();

  // If it contains the format somewhere inside, extract it
  const m = raw.match(/(VF-ORDER-\d+)/i);
  if (m?.[1]) return m[1].toUpperCase();

  // Fallback: VF-<last 8 chars of id>
  const suffix = order.id.slice(-8).toUpperCase();
  return `VF-${suffix}`;
}
