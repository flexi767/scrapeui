import { NextResponse } from "next/server";
import { raw } from "@/db/client";
import { savePublicMobileBgListingAsDraft } from "@/lib/mobile-bg/backup";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as {
      url?: string;
      dealerSlug?: string;
    } | null;
    const url = typeof payload?.url === "string" ? payload.url.trim() : "";
    const dealerSlug =
      typeof payload?.dealerSlug === "string" && payload.dealerSlug.trim()
        ? payload.dealerSlug.trim()
        : "carbros";

    if (!url) {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }

    const result = await savePublicMobileBgListingAsDraft(raw, dealerSlug, url);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save ad as draft",
      },
      { status: 500 },
    );
  }
}
