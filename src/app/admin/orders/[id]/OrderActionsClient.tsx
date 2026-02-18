// src/app/admin/orders/[id]/OrderActionsClient.tsx
"use client";

import { useState } from "react";

export default function OrderActionsClient({
  orderId,
  isCancelled,
  isArchived,
}: {
  orderId: string;
  isCancelled: boolean;
  isArchived: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function doCancel() {
    const reason = prompt("Cancel reason (optional):") || "";
    setBusy(true);
    try {
      await fetch(`/api/admin/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function doRestore() {
    setBusy(true);
    try {
      await fetch(`/api/admin/orders/${orderId}/cancel`, { method: "DELETE" });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function doArchive() {
    setBusy(true);
    try {
      await fetch(`/api/admin/orders/${orderId}/archive`, { method: "POST" });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function doUnarchive() {
    setBusy(true);
    try {
      await fetch(`/api/admin/orders/${orderId}/archive`, { method: "DELETE" });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isCancelled ? (
        <button
          type="button"
          disabled={busy}
          onClick={doCancel}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel order
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={doRestore}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Restore (uncancel)
        </button>
      )}

      {!isArchived ? (
        <button
          type="button"
          disabled={busy}
          onClick={doArchive}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Archive
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={doUnarchive}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Unarchive
        </button>
      )}
    </div>
  );
}
