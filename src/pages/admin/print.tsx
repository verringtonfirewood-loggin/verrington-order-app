import type { GetServerSideProps, NextPage } from "next";

type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  pricePence: number;
  quantity: number;
};

type Order = {
  id: string;
  createdAt?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  postcode?: string;
  totalPence?: number;
  status?: string;
  items?: OrderItem[];
};

type Props = {
  orders: Order[];
  missingIds: string[];
};

function getBaseUrl(req: any) {
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host =
    (req.headers["x-forwarded-host"] as string) ||
    (req.headers["host"] as string);
  return `${proto}://${host}`;
}

function formatGBP(pence?: number) {
  const value = typeof pence === "number" ? pence / 100 : 0;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function normalisePostcode(pc?: string) {
  return (pc || "").trim().toUpperCase().replace(/\s+/g, " ");
}

const PrintPage: NextPage<Props> = ({ orders, missingIds }) => {
  return (
    <div>
      <style>{`
        /* Screen wrapper */
        .wrap { max-width: 900px; margin: 0 auto; padding: 16px; }
        .toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }
        .btn { padding: 10px 14px; border-radius: 8px; border: 1px solid #111; background: #111; color: white; cursor: pointer; }
        .note { opacity: 0.7; font-size: 12px; }

        /* Print */
        @media print {
          .wrap { max-width: none; margin: 0; padding: 0; }
          .toolbar { display: none !important; }
          .page { page-break-after: always; }
          .page:last-child { page-break-after: auto; }
        }

        /* Page layout */
        .page {
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .head {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          justify-content: space-between;
          border-bottom: 1px solid #eee;
          padding-bottom: 12px;
          margin-bottom: 12px;
        }

        .postcode {
          font-size: 44px;
          font-weight: 900;
          letter-spacing: 1px;
          line-height: 1;
        }

        .meta {
          text-align: right;
          font-size: 12px;
          opacity: 0.8;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }

        .card {
          border: 1px solid #eee;
          border-radius: 12px;
          padding: 12px;
        }

        .label { font-size: 11px; opacity: 0.7; margin-bottom: 6px; }
        .value { font-size: 14px; }
        .strong { font-weight: 700; }

        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px 10px; border-top: 1px solid #eee; font-size: 13px; vertical-align: top; }
        thead th { background: #fafafa; border-top: none; text-align: left; font-size: 12px; opacity: 0.8; }
        .right { text-align: right; font-variant-numeric: tabular-nums; }

        .totalRow {
          border-top: 2px solid #111;
          font-weight: 800;
        }
      `}</style>

      <div className="wrap">
        <div className="toolbar">
          <button className="btn" onClick={() => window.print()}>
            Print
          </button>
          <div className="note">
            Tip: Use your browser’s print dialog. Each order prints on its own page.
          </div>
        </div>

        {missingIds.length > 0 && (
          <div style={{ marginBottom: 12, color: "crimson" }}>
            Could not load {missingIds.length} order(s): {missingIds.join(", ")}
          </div>
        )}

        {orders.length === 0 ? (
          <div>No orders to print.</div>
        ) : (
          orders.map((o) => {
            const items = o.items ?? [];
            const itemsTotal = items.reduce((sum, it) => sum + (it.pricePence ?? 0) * (it.quantity ?? 0), 0);
            const total = typeof o.totalPence === "number" ? o.totalPence : itemsTotal;

            return (
              <div key={o.id} className="page">
                <div className="head">
                  <div>
                    <div className="postcode">{normalisePostcode(o.postcode) || "—"}</div>
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                      Status: <span className="strong">{String(o.status || "—").toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="meta">
                    <div><span className="strong">Order:</span> {o.id.slice(0, 8)}</div>
                    <div><span className="strong">Created:</span> {formatDate(o.createdAt)}</div>
                  </div>
                </div>

                <div className="grid">
                  <div className="card">
                    <div className="label">Customer</div>
                    <div className="value strong">{o.customerName || "—"}</div>
                    <div className="value">{o.customerPhone || "—"}</div>
                    <div className="value">{o.customerEmail || "—"}</div>
                    <div className="value">{normalisePostcode(o.postcode) || "—"}</div>
                  </div>

                  <div className="card">
                    <div className="label">Driver notes</div>
                    <div className="value" style={{ height: 72, opacity: 0.8 }}>
                      _______________________________________________
                      <br />
                      _______________________________________________
                    </div>
                  </div>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="right">Qty</th>
                      <th className="right">Unit</th>
                      <th className="right">Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => {
                      const line = (it.pricePence ?? 0) * (it.quantity ?? 0);
                      return (
                        <tr key={it.id}>
                          <td>{it.name.split("(")[0].trim()}</td>
                          <td className="right">{it.quantity}</td>
                          <td className="right">{formatGBP(it.pricePence)}</td>
                          <td className="right">{formatGBP(line)}</td>
                        </tr>
                      );
                    })}

                    <tr className="totalRow">
                      <td>Total</td>
                      <td />
                      <td />
                      <td className="right">{formatGBP(total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const req = ctx.req as any;
  const baseUrl = getBaseUrl(req);
  const authorization = (req.headers["authorization"] as string) || "";

  const idsParam = typeof ctx.query.ids === "string" ? ctx.query.ids : "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Fetch each order detail from your existing API
  const missingIds: string[] = [];
  const orders: Order[] = [];

  // small concurrency to keep SSR fast + safe
  const concurrency = 6;
  let i = 0;

  async function worker() {
    while (i < ids.length) {
      const idx = i++;
      const id = ids[idx];
      try {
        const r = await fetch(`${baseUrl}/api/admin/orders/${encodeURIComponent(id)}`, {
          headers: authorization ? { authorization } : undefined,
        });
        if (!r.ok) {
          missingIds.push(id);
          continue;
        }
        const order = (await r.json()) as Order;
        orders.push(order);
      } catch {
        missingIds.push(id);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length || 1) }, () => worker()));

  // Keep print order stable: sort by postcode, then createdAt
  orders.sort((a, b) => {
    const ap = normalisePostcode(a.postcode);
    const bp = normalisePostcode(b.postcode);
    if (ap < bp) return -1;
    if (ap > bp) return 1;

    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return at - bt;
  });

  return { props: { orders, missingIds } };
};

export default PrintPage;
