// src/app/admin/orders/[id]/HusbandryPanel.tsx
"use client";

import { useMemo, useState } from "react";

type Log = { id: string; createdAt: string; author: string; note: string };

export default function HusbandryPanel({ orderId, logs }: { orderId: string; logs: Log[] }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const copy = [...(logs || [])];
    copy.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return copy;
  }, [logs]);

  async function addNote() {
    setError(null);
    const trimmed = note.trim();
    if (!trimmed) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/husbandry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: trimmed, author: "Admin" }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to add note");

      // simplest: refresh page
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Failed");
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Husbandry</h2>
        <span className="text-sm text-gray-500">{sorted.length} notes</span>
      </div>

      <div className="mt-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (customer request, delivery instructions, follow-up, etc.)"
          className="w-full rounded-lg border p-3 text-sm outline-none focus:ring-2"
          rows={3}
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={addNote}
            disabled={busy || !note.trim()}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Add note
          </button>
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {sorted.map((l) => (
          <div key={l.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{l.author}</div>
              <div className="text-xs text-gray-500">{new Date(l.createdAt).toLocaleString()}</div>
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{l.note}</div>
          </div>
        ))}
        {!sorted.length ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-gray-600">
            No notes yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
