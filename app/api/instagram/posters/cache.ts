import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  DEFAULT_POSTER_VARIANT_BY_ID,
  DEFAULT_POSTER_VARIANT_PROMPTS,
  type CollageSelections,
  type PosterVariantPrompt,
} from "@/lib/instagram/poster-variants";
import type { PosterVariantResult } from "@/app/api/instagram/posters/service";

interface CachedPosterVariant {
  id: string;
  name: string;
  role?: "cover" | "collage";
  filename: string;
}

interface CachedPosterManifest {
  variants: CachedPosterVariant[];
}

const POSTER_CACHE_ROOT = path.join(process.cwd(), "storage", "instagram-posters");
const POSTER_CACHE_VERSION = 4;

export function getPosterCacheDir({
  backupId,
  prompt,
  model,
  photoIds,
  variantPrompts,
  collageSelections,
}: {
  backupId: number;
  prompt: string;
  model: string;
  photoIds: number[];
  variantPrompts: PosterVariantPrompt[];
  collageSelections: CollageSelections;
}) {
  const cacheKey = createHash("sha256")
    .update(
      JSON.stringify({
        version: POSTER_CACHE_VERSION,
        backupId,
        prompt,
        model,
        photoIds,
        variantPrompts: variantPrompts.map((variant) => ({
          id: variant.id,
          prompt: variant.prompt,
          role: variant.role,
        })),
        collageSelections,
      }),
    )
    .digest("hex")
    .slice(0, 32);

  return path.join(POSTER_CACHE_ROOT, String(backupId), cacheKey);
}

export async function readCachedPosters(cacheDir: string): Promise<{ variants: PosterVariantResult[] } | null> {
  try {
    const manifest = JSON.parse(
      await readFile(path.join(cacheDir, "manifest.json"), "utf8"),
    ) as CachedPosterManifest;
    const variants = await Promise.all(
      manifest.variants.map(async (variant) => {
        const image = await readFile(path.join(cacheDir, variant.filename));
        return {
          id: variant.id,
          name: variant.name,
          role: variant.role ?? DEFAULT_POSTER_VARIANT_BY_ID.get(variant.id)?.role,
          dataUrl: `data:image/jpeg;base64,${image.toString("base64")}`,
        };
      }),
    );
    return { variants };
  } catch {
    return null;
  }
}

export async function writeCachedPosters(cacheDir: string, variants: PosterVariantResult[]) {
  await mkdir(cacheDir, { recursive: true });
  const manifest: CachedPosterManifest = {
    variants: variants.map((variant, index) => ({
      id: variant.id,
      name: variant.name,
      role: variant.role,
      filename: `${String(index + 1).padStart(2, "0")}-${variant.id}.jpg`,
    })),
  };

  await Promise.all(
    variants.map(async (variant, index) => {
      const base64 = variant.dataUrl.split(",")[1];
      if (!base64) throw new Error(`Could not cache ${variant.name}`);
      await writeFile(
        path.join(cacheDir, manifest.variants[index].filename),
        Buffer.from(base64, "base64"),
      );
    }),
  );
  await writeFile(path.join(cacheDir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

export function mergePosterVariants(current: PosterVariantResult[], next: PosterVariantResult[]) {
  const byId = new Map(current.map((variant) => [variant.id, variant]));
  next.forEach((variant) => byId.set(variant.id, variant));
  return DEFAULT_POSTER_VARIANT_PROMPTS.map((variant) => byId.get(variant.id)).filter(
    (variant): variant is PosterVariantResult => Boolean(variant),
  );
}

export function selectPosterVariants(variants: PosterVariantResult[], ids: string[]) {
  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  return ids.map((id) => byId.get(id)).filter((variant): variant is PosterVariantResult => Boolean(variant));
}
