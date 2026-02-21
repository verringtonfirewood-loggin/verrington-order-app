// src/app/admin/orders/[id]/StatusEditor.tsx
"use client";

import { useMemo, useState } from "react";

const STATUSES = ["NEW", "PAID", "OFD", "DELIVERED", "CANCELLED"] as const;

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export default function StatusEditor({
  orderId,
  initialStatus,
  initialArchivedAt,
  initialCancelledAt,
  initialCancelReason,
}: {
  orderId: string;
  initialStatus: string;
  initialArchivedAt: string | null;
  initialCancelledAt: string | null;
  initialCancelReason: string | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [archivedAt, setArchivedAt] = useState<string | null>(initialArchivedAt);
  const [cancelledAt, setCancelledAt] = useState<string | null>(initialCancelledAt);
  const [cancelReason, setCancelReason] = useState<string | null>(initialCancelReason);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isCancelled = useMemo(
    () => status === "CANCELLED" || !!cancelledAt,
    [status, cancelledAt]
  );
  const isArchived = useMemo(() => !!archivedAt, [archivedAt]);

  async function patch(payload: any) {
    setSaving(true);
    setErr(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);

      // Handle non-JSON / empty / HTML responses gracefully
      if (!res.ok) {
        const msg =
          (data as any)?.error ||
          (typeof (data as any)?.raw === "string" ? (data as any).raw : null) ||
          `Failed to update (${res.status})`;
        throw new Error(msg);
      }

      // Some handlers might return 204 or empty body — treat that as success.
      if (!data) {
        return;
      }

      if (!(data as any)?.ok) {
        throw new Error((data as any)?.error || "Failed to update");
      }

      const o = (data as any).order;

      if (o?.status) setStatus(o.status);
      setArchivedAt(o?.archivedAt ?? null);
      setCancelledAt(o?.cancelledAt ?? null);
      setCancelReason(o?.cancelReason ?? null);
    } catch (e: any) {
      setErr(e?.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(next: string) {
    await patch({ status: next });
  }

  async function cancelOrder() {
    const reason = window.prompt("Cancel reason (optional):", cancelReason ?? "") ?? "";
    await patch({ status: "CANCELLED", cancelReason: reason });
  }

  async function reopenOrder() {
    // clears cancel fields and sets status back to NEW (unless server changes it)
    await patch({ clearCancel: true });
  }

  async function archiveOrder() {
    await patch({ archived: true });
  }

  async function unarchiveOrder() {
    await patch({ unarchive: true });
  }

  return (
    <section className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-xl font-semibold">Admin actions</h2>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-sm font-medium text-gray-700">Status</label>

          <select
            className="w-full rounded-lg border p-2 sm:max-w-xs"
            value={status}
            onChange={(e) => updateStatus(e.target.value)}
            disabled={saving}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <div className="text-sm text-gray-600">
            {isCancelled ? "Cancelled" : "Active"}
            {isArchived ? " • Archived" : ""}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isCancelled && (
            <button
              onClick={cancelOrder}
              disabled={saving}
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 font-medium text-red-700 disabled:opacity-60"
            >
              Cancel order
            </button>
          )}

          {isCancelled && (
            <button
              onClick={reopenOrder}
              disabled={saving}
              className="rounded-lg border px-4 py-2 font-medium disabled:opacity-60"
            >
              Re-open (clear cancel)
            </button>
          )}

          {!isArchived && (
            <button
              onClick={archiveOrder}
              disabled={saving}
              className="rounded-lg border px-4 py-2 font-medium disabled:opacity-60"
            >
              Archive
            </button>
          )}

          {isArchived && (
            <button
              onClick={unarchiveOrder}
              disabled={saving}
              className="rounded-lg border px-4 py-2 font-medium disabled:opacity-60"
            >
              Unarchive
            </button>
          )}
        </div>

        {isCancelled && (cancelReason || cancelledAt) && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div className="font-semibold">Cancelled</div>
            {cancelReason ? <div className="mt-1">Reason: {cancelReason}</div> : null}
          </div>
        )}

        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}
      </div>
    </section>
  );
}
