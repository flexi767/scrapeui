import { NextRequest } from "next/server";
import { raw } from "@/db/client";
import { requireAuth } from "@/lib/api/auth-helpers";
import { buildInstagramListingPayload } from "@/lib/instagram/listing-payload";
import {
  getPosterCacheDir,
  mergePosterVariants,
  readCachedPosters,
  selectPosterVariants,
  writeCachedPosters,
} from "./cache";
import {
  generatePosterVariants,
  parseCollageSelections,
  parseVariantId,
  parseVariantPrompts,
  type PosterRequestBody,
} from "./service";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured", variants: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = (await request.json()) as PosterRequestBody;
  const backupId = Number(body.backupId);
  if (!Number.isFinite(backupId)) {
    return Response.json({ error: "Invalid backupId" }, { status: 400 });
  }

  const listing = buildInstagramListingPayload(raw, backupId, {
    origin: request.nextUrl.origin,
    signedPhotoUrls: true,
  });
  if (!listing) {
    return Response.json({ error: "Listing not found" }, { status: 404 });
  }

  const prompt =
    typeof body.prompt === "string" && body.prompt.trim()
      ? body.prompt.trim()
      : `Create a premium Instagram poster for ${listing.title}.`;
  const force = body.force === true;
  const cacheOnly = body.cacheOnly === true;
  const model = process.env.INSTAGRAM_POSTER_IMAGE_MODEL ?? "gpt-image-2";
  const variantPrompts = parseVariantPrompts(body.variantPrompts);
  const variantId = parseVariantId(body.variantId);
  let targetVariantPrompts = variantId
    ? variantPrompts.filter((variant) => variant.id === variantId)
    : variantPrompts;
  if (variantId && targetVariantPrompts.length === 0) {
    return Response.json({ error: "Invalid variantId", variants: [] }, { status: 400 });
  }
  const collageSelections = parseCollageSelections(body.collageSelections);
  let targetVariantIds = targetVariantPrompts.map((variant) => variant.id);
  const cacheDir = getPosterCacheDir({
    backupId,
    prompt,
    model,
    photoIds: listing.photos.map((photo) => photo.id),
    variantPrompts,
    collageSelections,
  });

  if (!force) {
    const cached = await readCachedPosters(cacheDir);
    if (cached) {
      const targetCachedVariants = selectPosterVariants(cached.variants, targetVariantIds);
      if (targetCachedVariants.length === targetVariantIds.length) {
        return Response.json(
          { variants: targetCachedVariants, cached: true },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      if (cacheOnly && cached.variants.length > 0) {
        return Response.json(
          { variants: cached.variants, cached: true },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      const missingIds = targetVariantIds.filter(
        (id) => !targetCachedVariants.some((variant) => variant.id === id),
      );
      targetVariantPrompts = targetVariantPrompts.filter((variant) => missingIds.includes(variant.id));
      targetVariantIds = missingIds;
    }
  }

  if (cacheOnly) {
    const cached = await readCachedPosters(cacheDir);
    if (cached && cached.variants.length > 0) {
      return Response.json(
        { variants: cached.variants, cached: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { variants: [], cached: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const imageResults = await generatePosterVariants({
      listing,
      prompt,
      model,
      apiKey,
      variantPrompts: targetVariantPrompts,
      collageSelections,
    });

    if (imageResults.length === 0) {
      return Response.json(
        { error: "Image API returned no poster images", variants: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const existing = await readCachedPosters(cacheDir);
    const variantsToCache = existing ? mergePosterVariants(existing.variants, imageResults) : imageResults;
    await writeCachedPosters(cacheDir, variantsToCache).catch((cacheError) => {
      console.error("Could not cache Instagram posters", cacheError);
    });

    return Response.json(
      { variants: variantId ? imageResults : variantsToCache, cached: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not generate AI posters", variants: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
