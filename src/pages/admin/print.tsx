import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";

type OrderItem = {
  id: string;
  name?: string | null;
  productId: string;
  quantity: number;
  pricePence: number;
};

type Order = {
  id: string;
  createdAt: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  postcode: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  town?: string | null;
  county?: string | null;
  deliveryNotes?: string | null;
  status: string;
  totalPence: number;
  items: OrderItem[];
  orderNumber?: string | null;
};

function base64Utf8(input: string) {
  if (typeof window === "undefined") return "";
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return window.btoa(binary);
}

function formatGBPFromPence(pence: number) {
  const gbp = (pence || 0) / 100;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(gbp);
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

const PrintPage: NextPage = () => {
  const router = useRouter();
  const idsParam = typeof router.query.ids === "string" ? router.query.ids : "";
  const ids = useMemo(() => idsParam.split(",").map((s) => s.trim()).filter(Boolean), [idsParam]);

  const [user, setUser] = useState("mike");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  const authHeader = useMemo(() => {
    const pair = `${user}:${pass}`;
    const b64 = base64Utf8(pair);
    return `Basic ${b64}`;
  }, [user, pass]);

  async function load() {
    if (!ids.length) {
      setErr("No ids provided. Use /admin/print?ids=id1,id2");
      return;
    }
    if (!pass) {
      setErr("Enter admin password, then Load.");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const out: Order[] = [];
      for (const id of ids) {
        const r = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
          headers: { Authorization: authHeader },
        });
        const j = await r.json();
        if (!r.ok || !j?.ok) throw new Error(j?.error ?? `Failed to load ${id}`);
        out.push(j.order as Order);
      }
      setOrders(out);
    } catch (e: any) {
      setOrders([]);
      setErr(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 20 }}>
      <div className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Link href="/admin/dispatch" style={{ textDecoration: "none", fontWeight: 900 }}>
          ← Back to Dispatch
        </Link>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="user" style={inp} />
          <input value={pass} onChange={(e) => setPass(e.target.value)} placeholder="pass" type="password" style={inp} />
          <button onClick={load} disabled={loading} style={btn}>
            {loading ? "Loading…" : "Load"}
          </button>
          <button onClick={() => window.print()} disabled={!orders.length} style={btn2}>
            Print
          </button>
        </div>
      </div>

      {err ? (
        <div className="no-print" style={{ marginTop: 12, padding: 12, border: "1px solid #f3c2c2", borderRadius: 12, background: "#fff5f5" }}>
          <b style={{ color: "crimson" }}>Fix needed:</b> {err}
        </div>
      ) : null}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .docket { page-break-after: always; }
        }
      `}</style>

      {orders.map((o) => (
        <section key={o.id} className="docket" style={{ marginTop: 18, border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>Verrington Firewood</div>
              <div style={{ opacity: 0.7 }}>Delivery Docket</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 900 }}>{o.orderNumber ?? o.id}</div>
              <div style={{ opacity: 0.7 }}>{formatDateTime(o.createdAt)}</div>
              <div style={{ opacity: 0.7 }}>{String(o.status).toUpperCase()}</div>
            </div>
          </div>

          <hr style={{ margin: "14px 0", border: 0, borderTop: "1px solid #eee" }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Customer</div>
              <div style={{ fontWeight: 800 }}>{o.customerName}</div>
              <div style={{ opacity: 0.85 }}>{o.customerPhone ?? ""}</div>
              <div style={{ opacity: 0.85 }}>{o.customerEmail ?? ""}</div>
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Address</div>
              <div style={{ fontWeight: 800 }}>{o.postcode}</div>
              {[o.addressLine1, o.addressLine2, o.town, o.county].filter(Boolean).map((line, idx) => (
                <div key={idx} style={{ opacity: 0.85 }}>
                  {line}
                </div>
              ))}
              {o.deliveryNotes ? (
                <div style={{ marginTop: 8, padding: 10, border: "1px dashed #ddd", borderRadius: 10 }}>
                  <b>Notes:</b> {o.deliveryNotes}
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Items</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  <th style={th}>Item</th>
                  <th style={thR}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((it) => (
                  <tr key={it.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={td}>{it.name ?? it.productId}</td>
                    <td style={tdR}>{it.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 12, textAlign: "right", fontWeight: 900, fontSize: 18 }}>
              Total: {formatGBPFromPence(o.totalPence)}
            </div>
          </div>
        </section>
      ))}
    </main>
  );
};

const inp: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" };
const btn: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", fontWeight: 900 };
const btn2: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", fontWeight: 900 };

const th: React.CSSProperties = { textAlign: "left", padding: 10, opacity: 0.75 };
const thR: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: 10 };
const tdR: React.CSSProperties = { ...td, textAlign: "right", fontWeight: 900 };

export default PrintPage;
