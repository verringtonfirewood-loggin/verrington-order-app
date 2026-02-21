// app/api/public/google-rating/route.ts
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

// We want fresh-ish data, but don't hammer Google on every request.
// We'll cache at the edge (Vercel) for 1 hour and allow stale while revalidating.
export const dynamic = "force-dynamic";

type Place = {
  id?: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
};

async function fetchPlaceByText(apiKey: string, textQuery: string): Promise<Place> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.rating,places.userRatingCount,places.googleMapsUri",
    },
    body: JSON.stringify({ textQuery, maxResultCount: 1 }),
    // Let our response headers control caching; don't disable caching here.
    // (Also avoids rate-limit pain if you get traffic.)
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as any;

  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Google Places searchText failed");
  }

  const place: Place | undefined = data?.places?.[0];
  if (!place?.id) throw new Error("Place not found");

  return place;
}

export async function GET(_req: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const textQuery = process.env.GOOGLE_PLACES_QUERY;

  // Support either env var naming; keep server-only by default.
  const reviewUrl =
    process.env.GOOGLE_REVIEW_URL ||
    process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL ||
    null;

  if (!apiKey || !textQuery) {
    return NextResponse.json(
      { ok: false, error: "Missing Google env vars", reviewUrl },
      { status: 500 }
    );
  }

  try {
    const place = await fetchPlaceByText(apiKey, textQuery);

    return NextResponse.json(
      {
        ok: true,
        name: place.displayName?.text ?? "Verrington Firewood",
        rating: typeof place.rating === "number" ? place.rating : null,
        count:
          typeof place.userRatingCount === "number" ? place.userRatingCount : null,
        mapsUrl: place.googleMapsUri ?? null,
        reviewUrl,
        attribution: "Powered by Google",
      },
      {
        // Vercel-friendly caching: cache for 1 hour, serve stale while revalidating up to 1 day
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (e: any) {
    // Still return reviewUrl so the CTA can render even if Places fails
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to load rating", reviewUrl },
      {
        status: 502,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      }
    );
  }
}
