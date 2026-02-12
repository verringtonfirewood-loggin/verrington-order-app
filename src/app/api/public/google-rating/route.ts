import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Place = {
  id?: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
};

async function fetchPlaceByText(apiKey: string, textQuery: string) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.rating,places.userRatingCount,places.googleMapsUri",
    },
    body: JSON.stringify({ textQuery, maxResultCount: 1 }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Google Places searchText failed");
  }

  const place = data?.places?.[0];
  if (!place?.id) throw new Error("Place not found");

  return place;
}

export async function GET(_req: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const textQuery = process.env.GOOGLE_PLACES_QUERY;
  const reviewUrl = process.env.GOOGLE_REVIEW_URL;

  if (!apiKey || !textQuery) {
    return NextResponse.json(
      { ok: false, error: "Missing Google env vars" },
      { status: 500 }
    );
  }

  try {
    const place = await fetchPlaceByText(apiKey, textQuery);

    return NextResponse.json({
      ok: true,
      name: place.displayName?.text ?? "Verrington Firewood",
      rating: place.rating ?? null,
      count: place.userRatingCount ?? null,
      mapsUrl: place.googleMapsUri ?? null,
      reviewUrl: reviewUrl ?? null,
      attribution: "Powered by Google",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to load rating" },
      { status: 502 }
    );
  }
}
