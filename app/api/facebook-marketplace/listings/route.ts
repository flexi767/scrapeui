import { NextRequest } from "next/server";
import { raw } from "@/db/client";
import { requireAuth } from "@/lib/api/auth-helpers";
import { buildMarketplaceListingPayloads } from "@/lib/facebook-marketplace/listing-payload";
import { getOwnListings } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const sp = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit") || 50), 1), 300);
  const search = sp.get("search") || "";
  const origin = request.nextUrl.origin;

  const { data } = getOwnListings({
    page: 1,
    limit,
    search,
    sort: "last_edit",
    order: "desc",
  });

  const listings = buildMarketplaceListingPayloads(
    raw,
    data.map((row) => row.backup_id),
    { origin, signedPhotoUrls: true },
  );

  return Response.json(
    { listings },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
