// src/app/admin/orders/[id]/HusbandryPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type HusbandryLog = {
  id: string;
  createdAt: string;
  note: string;
  author: string | null;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function HusbandryPanel({
  orderId,
  initialLogs,
}: {
  orderId: string;
  initialLogs: HusbandryLog[];
}) {
  const [logs, setLogs] = useState<HusbandryLog[]>(initialLogs || []);
  const [note, setNote] = useState("");
  const [author, setAuthor] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const count = useMemo(() => logs.length, [logs]);

  async function refresh() {
    const res = await fetch(`/api/admin/orders/${orderId}/husbandry`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load logs");
    setLogs(data.logs || []);
  }

  useEffect(() => {
    // Keep it simple: rely on initialLogs unless you want live refresh
  }, []);

  async function addLog() {
    setErr(null);
    const trimmed = note.trim();
    if (!trimmed) {
      setErr("Please enter a note.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/husbandry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: trimmed,
          author: author.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to add note");

      setNote("");
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Failed to add note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-10 rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Husbandry</h2>
        <div className="text-sm text-gray-600">{count} note{count === 1 ? "" : "s"}</div>
      </div>

      <div className="mt-4 grid gap-3">
        <textarea
          className="w-full rounded-lg border p-3"
          rows={4}
          placeholder="Add a note (e.g. customer called, delivery instructions, refund agreed...)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <input
            className="w-full rounded-lg border p-2 sm:max-w-xs"
            placeholder="Author (optional)"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />

          <button
            onClick={addLog}
            disabled={saving}
            className="rounded-lg bg-purple-700 px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add note"}
          </button>
        </div>

        {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      </div>

      <div className="mt-6 space-y-3">
        {!logs.length && (
          <div className="text-sm text-gray-600">No husbandry notes yet.</div>
        )}

        {logs.map((l) => (
          <div key={l.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium text-gray-900">
                {l.author ? l.author : "Admin"}
              </div>
              <div className="text-xs text-gray-500">{formatDate(l.createdAt)}</div>
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{l.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
