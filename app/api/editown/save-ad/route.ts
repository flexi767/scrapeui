import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth-helpers";

export const runtime = "nodejs";

export async function POST() {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  return NextResponse.json(
    { error: "Save ad as draft is not available in this version" },
    { status: 501 },
  );
}
