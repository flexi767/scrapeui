import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth-helpers";
import {
  createSavedSearch,
  getSavedSearchDetail,
  listSavedSearchSummaries,
} from "@/lib/mobile-bg/saved-searches";
import { readJsonBody } from "@/lib/api/json-body";
import { parseSearchFields } from "@/lib/mobile-bg/search-form-shared";

export async function GET() {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  return NextResponse.json({
    searches: listSavedSearchSummaries(),
  });
}

export async function POST(request: Request) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const payload = await readJsonBody<{ fields?: unknown }>(request);

  const fields = parseSearchFields(payload?.fields);
  if (!fields) {
    return NextResponse.json(
      { error: "fields must be an array of search fields" },
      { status: 400 },
    );
  }

  const id = createSavedSearch(null, fields);
  const detail = await getSavedSearchDetail(id);
  if (!detail) {
    return NextResponse.json(
      { error: "Saved search created but could not be loaded" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    detail,
    searches: listSavedSearchSummaries(),
  });
}
