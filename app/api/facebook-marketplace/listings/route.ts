import { NextRequest } from "next/server";
import { raw } from "@/db/client";
import { buildMarketplaceListingPayload } from "@/lib/facebook-marketplace/listing-payload";
import { getOwnListings } from "@/lib/queries";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Private-Network": "true",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit") || 100), 1), 300);
  const search = sp.get("search") || "";
  const origin = request.nextUrl.origin;

  const { data } = getOwnListings({
    page: 1,
    limit,
    search,
    sort: "last_edit",
    order: "desc",
  });

  const listings = data
    .map((row) => buildMarketplaceListingPayload(raw, row.backup_id, { origin }))
    .filter(Boolean);

  return Response.json(
    { listings },
    {
      headers: {
        ...corsHeaders,
        "Cache-Control": "no-store",
      },
    },
  );
}
