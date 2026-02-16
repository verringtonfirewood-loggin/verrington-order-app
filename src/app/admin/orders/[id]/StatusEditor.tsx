// src/app/admin/orders/[id]/StatusEditor.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const STATUSES = ["NEW", "CONFIRMED", "PAID", "OUT-FOR-DELIVERY", "DELIVERED"] as const;

export default function StatusEditor({
  orderId,
  initialStatus,
}: {
  orderId: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  // Track last good status for correct rollback
  const lastGood = useRef(initialStatus);

  useEffect(() => {
    setStatus(initialStatus);
    lastGood.current = initialStatus;
  }, [initialStatus]);

  async function save(nextStatus: string) {
    // optimistic update
    setStatus(nextStatus);
    setSaving(true);

    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    setSaving(false);

    if (!res.ok) {
      // rollback to last good status
      setStatus(lastGood.current);
      alert("Failed to update status");
      return;
    }

    // success: update rollback point
    lastGood.current = nextStatus;

    // refresh server-rendered pages
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        disabled={saving || isPending}
        onChange={(e) => save(e.target.value)}
        className="rounded border px-2 py-1"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <span className="text-sm opacity-70">
        {saving || isPending ? "Saving…" : ""}
      </span>

      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">
        {status}
      </span>
    </div>
  );
}
