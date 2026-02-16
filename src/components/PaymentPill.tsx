"use client";

function paymentLabel(method: string) {
  const m = String(method || "").toUpperCase();
  if (m === "MOLLIE") return "CARD";
  return m || "—";
}

function paymentColours(method: string, status: string) {
  const m = String(method || "").toUpperCase();
  const s = String(status || "").toUpperCase();

  if (s === "PAID") return { bg: "#e8f7ee", fg: "#1f7a4c", border: "#b7ebce" };
  if (s === "PENDING") return { bg: "#fff4e5", fg: "#b54708", border: "#fcd9bd" };
  if (s === "FAILED") return { bg: "#fdecec", fg: "#b42318", border: "#f5c2c0" };
  if (s === "EXPIRED") return { bg: "#fff0e5", fg: "#9a3412", border: "#fed7aa" };
  if (s === "CANCELED") return { bg: "#f4f4f5", fg: "#3f3f46", border: "#e4e4e7" };

  if (s === "UNPAID") {
    if (m === "BACS") return { bg: "#e8f3ff", fg: "#1e40af", border: "#bfdbfe" };
    if (m === "CASH") return { bg: "#f3f4f6", fg: "#111827", border: "#d1d5db" };
    if (m === "MOLLIE") return { bg: "#fff4e5", fg: "#b54708", border: "#fcd9bd" };
  }

  return { bg: "#f3f4f6", fg: "#444", border: "#e5e7eb" };
}

export default function PaymentPill({
  method,
  status,
}: {
  method: string;
  status: string;
}) {
  const c = paymentColours(method, status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}
    >
      {paymentLabel(method)} • {String(status || "").toUpperCase() || "—"}
    </span>
  );
}
