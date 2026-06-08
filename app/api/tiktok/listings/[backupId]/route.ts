import { type NextRequest } from "next/server";
import { raw } from "@/db/client";
import { buildInstagramListingPayload } from "@/lib/instagram/listing-payload";
import { requireAuth } from "@/lib/api/auth-helpers";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ backupId: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const { backupId } = await params;
  const id = Number(backupId);
  if (!Number.isFinite(id)) {
    return Response.json({ error: "Invalid backupId" }, { status: 400 });
  }

  const payload = buildInstagramListingPayload(raw, id, {
    origin: request.nextUrl.origin,
    signedPhotoUrls: true,
  });

  if (!payload) {
    return Response.json({ error: "Listing not found" }, { status: 404 });
  }

  return Response.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
