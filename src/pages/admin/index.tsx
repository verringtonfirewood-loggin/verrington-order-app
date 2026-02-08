import { useEffect } from "react";

export default function AdminIndex() {
  useEffect(() => {
    window.location.replace("/admin/orders");
  }, []);

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, Arial" }}>
      Redirecting…
    </main>
  );
}
