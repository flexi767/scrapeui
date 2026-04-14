import { NextResponse } from "next/server";
import {
  createSavedSearch,
  getSavedSearchDetail,
  listSavedSearchSummaries,
} from "@/lib/mobile-bg/saved-searches";
import type { SearchField } from "@/lib/mobile-bg/search-form-shared";

function parseFields(payload: unknown): SearchField[] | null {
  if (!Array.isArray(payload)) return null;

  const fields: SearchField[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== "object") return null;
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.name !== "string" ||
      typeof candidate.label !== "string" ||
      typeof candidate.value !== "string"
    ) {
      return null;
    }
    fields.push({
      name: candidate.name,
      label: candidate.label,
      value: candidate.value,
      source:
        candidate.source === "default" ||
        candidate.source === "listing" ||
        candidate.source === "derived" ||
        candidate.source === "saved"
          ? candidate.source
          : "saved",
    });
  }

  return fields;
}

export async function GET() {
  return NextResponse.json({
    searches: listSavedSearchSummaries(),
  });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    fields?: unknown;
  } | null;

  const fields = parseFields(payload?.fields);
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
