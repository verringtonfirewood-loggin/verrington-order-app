// src/components/GoogleRatingBadge.tsx
"use client";

import { useEffect, useState } from "react";

type Resp = {
  ok: boolean;
  error?: string;

  name?: string;
  rating?: number | null;
  count?: number | null;

  mapsUrl?: string | null;
  reviewUrl?: string | null;

  attribution?: string;
};

function StarRow({ rating }: { rating: number }) {
  const full = Math.round(rating);
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
    let cancelled = false;

    fetch("/api/public/google-rating")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData({ ok: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // If we have absolutely nothing, render nothing.
  if (!data) return null;

  const hasRating = typeof data.rating === "number";
  const hasReviewUrl = !!data.reviewUrl;

  // If no rating AND no review URL, there's nothing useful to show.
  if (!hasRating && !hasReviewUrl) return null;

  return (
    <div
      className="rounded-2xl border p-4 text-sm vf-animate-fade-in-up"
      style={{ background: "var(--vf-surface)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">
            {data.name ?? "Verrington Firewood"}
          </div>

          {hasRating ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="font-bold">{data.rating!.toFixed(1)}</span>
              <StarRow rating={data.rating!} />
              {typeof data.count === "number" ? (
                <span className="text-[var(--vf-muted)]">
                  {data.count} Google reviews
                </span>
              ) : null}
            </div>
          ) : (
            <div className="mt-1 text-sm text-[var(--vf-muted)]">
              Reviews on Google
            </div>
          )}
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

      {!data.ok && data.error ? (
        <div className="mt-3 text-xs text-[var(--vf-muted)]">
          (Rating temporarily unavailable)
        </div>
      ) : null}
    </div>
  );
}
