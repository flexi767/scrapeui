import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "Save ad as draft is not available in this version" },
    { status: 501 },
  );
}
