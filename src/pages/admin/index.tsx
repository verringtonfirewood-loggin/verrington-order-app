import type { NextPage } from "next";
import Link from "next/link";

const AdminHome: NextPage = () => {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 20 }}>
      <h1 style={{ margin: 0, fontSize: 30 }}>Admin</h1>
      <p style={{ opacity: 0.75, marginTop: 8 }}>Verrington Order App</p>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <Link href="/admin/orders" style={card}>
          <div style={title}>Orders</div>
          <div style={sub}>Search, view, update statuses</div>
        </Link>

        <Link href="/admin/dispatch" style={card}>
          <div style={title}>Dispatch</div>
          <div style={sub}>Bulk select → print dockets → mark out for delivery</div>
        </Link>

        <Link href="/admin/print" style={card}>
          <div style={title}>Print</div>
          <div style={sub}>Print one or more orders by ID</div>
        </Link>
      </div>
    </main>
  );
};

const card: React.CSSProperties = {
  display: "block",
  padding: 16,
  border: "1px solid #eee",
  borderRadius: 14,
  textDecoration: "none",
  color: "inherit",
  background: "white",
};

const title: React.CSSProperties = { fontWeight: 900, fontSize: 18 };
const sub: React.CSSProperties = { marginTop: 6, opacity: 0.7 };

export default AdminHome;
