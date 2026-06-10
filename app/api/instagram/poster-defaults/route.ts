import { z } from "zod";
import { requireAuth } from "@/lib/api/auth-helpers";
import {
  getInstagramPosterDefaults,
  getInstagramPosterDefaultsScope,
  saveInstagramPosterDefaults,
} from "@/lib/instagram/poster-defaults-store";
import { parsePosterVariantPrompts } from "@/lib/instagram/poster-variants";

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

const PosterDefaultsBodySchema = z.object({
  promptTemplate: z.unknown().optional(),
  variantPrompts: z.unknown().optional(),
}).passthrough();

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const scopeKey = getInstagramPosterDefaultsScope(auth.session.user.dealerId);
  return Response.json(getInstagramPosterDefaults(scopeKey) ?? null, {
    headers: NO_STORE_HEADERS,
  });
}

export async function PUT(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const raw = await request.json().catch(() => null);
  const parsed = PosterDefaultsBodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data as { promptTemplate?: unknown; variantPrompts?: unknown };

  const promptTemplate = typeof body?.promptTemplate === "string" ? body.promptTemplate.trim() : "";
  if (!promptTemplate) {
    return Response.json({ error: "promptTemplate is required" }, { status: 400 });
  }

  const scopeKey = getInstagramPosterDefaultsScope(auth.session.user.dealerId);
  const defaults = {
    promptTemplate,
    variantPrompts: parsePosterVariantPrompts(body?.variantPrompts),
  };
  saveInstagramPosterDefaults(scopeKey, defaults);

  return Response.json(defaults, {
    headers: NO_STORE_HEADERS,
  });
}
