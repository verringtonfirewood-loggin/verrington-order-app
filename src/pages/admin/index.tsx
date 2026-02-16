import type { NextPage } from "next";
import Link from "next/link";
import { clearAdminCreds, loadAdminCreds } from "@/lib/adminClientAuth";
import { useEffect, useState } from "react";

const AdminHome: NextPage = () => {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setHasSession(!!loadAdminCreds());
  }, []);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 20 }}>
      <h1>Admin</h1>
      <p style={{ opacity: 0.7 }}>Verrington Order App</p>

      {hasSession && (
        <button
          onClick={() => {
            clearAdminCreds();
            location.reload();
          }}
        >
          Clear Admin Session
        </button>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <Link href="/admin/orders">Orders</Link>
        <Link href="/admin/dispatch">Dispatch</Link>
        <Link href="/admin/print">Print</Link>
      </div>
    </main>
  );
};

export default AdminHome;
