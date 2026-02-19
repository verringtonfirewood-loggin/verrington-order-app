// src/components/admin/BackButton.tsx
"use client";

import { useRouter } from "next/navigation";

export default function BackButton({ fallback = "/admin/orders" }: { fallback?: string }) {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button
      onClick={handleBack}
      type="button"
      className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
      aria-label="Back"
    >
      <span aria-hidden>←</span>
      <span>Back</span>
    </button>
  );
}
