"use client";

import { useEffect, useState } from "react";

type Resp = {
  ok: boolean;
  name?: string;
  rating?: number | null;
  count?: number | null;
  mapsUrl?: string | null;
  reviewUrl?: string | null;
  attribution?: string;
};

function StarRow({ rating }: { rating: number }) {
  const full = Math.round(rating); // simple + clean
  return (
    <span aria-label={`${rating} stars`} className="tracking-wide">
      {"★".repeat(full)}
      {"☆".repeat(Math.max(0, 5 - full))}
    </span>
  );
}

export default function GoogleRatingBadge() {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    fetch("/api/public/google-rating", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ ok: false }));
  }, []);

  if (!data?.ok || typeof data.rating !== "number") return null;

  return (
    <div
      className="rounded-2xl border p-4 text-sm"
      style={{ background: "var(--vf-surface)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{data.name}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-bold">{data.rating.toFixed(1)}</span>
            <StarRow rating={data.rating} />
            {typeof data.count === "number" ? (
              <span className="text-[var(--vf-muted)]">({data.count})</span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-xs text-[var(--vf-muted)]">
          {data.attribution ?? "Powered by Google"}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        {data.mapsUrl ? (
          <a
            className="underline text-[var(--vf-text)]"
            href={data.mapsUrl}
            target="_blank"
            rel="noreferrer"
          >
            View on Google
          </a>
        ) : null}

        {data.reviewUrl ? (
          <a
            className="underline font-semibold"
            href={data.reviewUrl}
            target="_blank"
            rel="noreferrer"
          >
            Leave a review
          </a>
        ) : null}
      </div>
    </div>
  );
}
