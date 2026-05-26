import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { raw } from "@/db/client";
import { buildInstagramListingPayload } from "@/lib/instagram/listing-payload";
import {
  DEFAULT_POSTER_VARIANT_BY_ID,
  DEFAULT_POSTER_VARIANT_PROMPTS,
  parsePosterCollageSelections,
  parsePosterVariantPrompts,
  type CollageSelections,
  type PosterVariantPrompt,
} from "@/lib/instagram/poster-variants";
import { formatListingMileage, formatListingPrice } from "@/lib/listing-format";

export interface PosterRequestBody {
  backupId?: unknown;
  prompt?: unknown;
  force?: unknown;
  cacheOnly?: unknown;
  variantId?: unknown;
  variantPrompts?: unknown;
  collageSelections?: unknown;
}

export interface PosterVariantResult {
  id: string;
  name: string;
  role?: "cover" | "collage";
  dataUrl: string;
}

interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
}

interface ReferenceImageRow {
  id: number;
  filename: string | null;
  local_path: string | null;
}

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

export function parseVariantPrompts(raw: unknown) {
  return parsePosterVariantPrompts(raw);
}

export function parseVariantId(raw: unknown) {
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function parseCollageSelections(raw: unknown) {
  return parsePosterCollageSelections(raw);
}

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

function buildImagePrompt(
  listing: NonNullable<ReturnType<typeof buildInstagramListingPayload>>,
  prompt: string,
  variant: PosterVariantPrompt,
) {
  const title = [listing.make, listing.model].filter(Boolean).join(" ") || listing.title;
  const specs = [
    listing.year ? `year ${listing.year}` : null,
    listing.color ? `color ${listing.color}` : null,
    listing.fuel ? `fuel ${listing.fuel}` : null,
    listing.transmission ? `transmission ${listing.transmission}` : null,
    listing.power ? `${listing.power} hp` : null,
    `mileage ${formatListingMileage(listing.mileage)}`,
    `price ${formatListingPrice(listing.price)}`,
  ].filter(Boolean);

  return [
    "Use case: product-mockup",
    `Asset type: Instagram square vehicle ${variant.role === "collage" ? "carousel collage page" : "cover poster"}`,
    `Primary request: ${prompt}`,
    `Variant direction: ${variant.prompt}`,
    `Subject: ${title}. ${specs.join(", ")}.`,
    "Style/medium: premium hyperrealistic automotive advertising, cinematic reflections, editorial car photography, high-end dealership campaign.",
    variant.role === "collage"
      ? "Composition/framing: square 1:1 Instagram carousel collage page, elegant multi-photo grid, consistent spacing, premium editorial hierarchy, very little text."
      : "Composition/framing: square 1:1 Instagram cover, dramatic vehicle hero angle, strong poster hierarchy, room for headline and offer details.",
    "Lighting/mood: cinematic reflections, polished surfaces, high-end dealership campaign.",
    "Text: avoid dense text. Any visible text must be Bulgarian only. Do not render contact/footer text; it will be added later.",
    "Reference fidelity: use the provided listing photos as visual references for the exact car. Preserve the visible wheel design/rims, tire proportions, and license plate text/number from the reference photos whenever they are visible. Do not invent a different number plate. Do not change the car generation, body kit, headlights, grille, or wheel style.",
    variant.id === "ai-exterior-collage"
      ? "Reference selection: use these as exterior/outside car photos. Build a collage page from the outside views."
      : null,
    variant.id === "ai-interior-collage"
      ? "Reference selection: use these as interior/cabin/detail photos. Build a collage page from the inside views."
      : null,
    variant.role === "collage"
      ? "Constraints: create a styled collage page from the provided references, not a single-car render; no watermarks; no app chrome; no browser UI."
      : "Constraints: create a fully generated poster image, not a flat UI mockup or simple photo collage; no watermarks; no app chrome; no browser UI.",
    "Avoid: mismatched wheels, altered rims, changed license plate characters, cheap flyer style, clutter, distorted car geometry, unreadable dense text, fake badges, extra logos.",
  ]
    .filter(Boolean)
    .join("\n");
}

function getReferenceImages(photoIds: number[]) {
  if (photoIds.length === 0) return [];
  const placeholders = photoIds.map(() => "?").join(", ");
  const rows = raw
    .prepare(
      `SELECT id, filename, local_path
       FROM mobilebg_backup_images
       WHERE id IN (${placeholders})`,
    )
    .all(...photoIds) as ReferenceImageRow[];
  const byId = new Map(rows.map((row) => [row.id, row]));
  return photoIds
    .map((id) => byId.get(id))
    .filter((row): row is ReferenceImageRow => Boolean(row?.local_path));
}

function mimeFromFilename(filename: string | null, localPath: string) {
  const ext = path.extname(filename || localPath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "image/webp";
}

async function appendReferenceImages(formData: FormData, referenceImages: ReferenceImageRow[]) {
  for (const image of referenceImages) {
    if (!image.local_path) continue;
    const bytes = await readFile(image.local_path);
    const filename = image.filename || path.basename(image.local_path);
    const file = new File([bytes], filename, {
      type: mimeFromFilename(filename, image.local_path),
    });
    formData.append("image[]", file);
  }
}

function getVariantPhotoIds(
  listing: NonNullable<ReturnType<typeof buildInstagramListingPayload>>,
  variantId: string,
  collageSelections: { exteriorPhotoIds: number[]; interiorPhotoIds: number[] },
) {
  const listingIds = new Set(listing.photos.map((photo) => photo.id));
  const validIds = (ids: number[]) => ids.filter((id) => listingIds.has(id));
  if (variantId === "ai-exterior-collage") return validIds(collageSelections.exteriorPhotoIds);
  if (variantId === "ai-interior-collage") return validIds(collageSelections.interiorPhotoIds);
  return listing.photos.slice(0, 4).map((photo) => photo.id);
}

export async function generatePosterVariants({
  listing,
  prompt,
  model,
  apiKey,
  variantPrompts,
  collageSelections,
}: {
  listing: NonNullable<ReturnType<typeof buildInstagramListingPayload>>;
  prompt: string;
  model: string;
  apiKey: string;
  variantPrompts: PosterVariantPrompt[];
  collageSelections: CollageSelections;
}) {
  return Promise.all(
    variantPrompts.map(async (variant) => {
      const imagePrompt = buildImagePrompt(listing, prompt, variant);
      const referenceImages = getReferenceImages(getVariantPhotoIds(listing, variant.id, collageSelections));
      const hasReferences = referenceImages.length > 0;
      const body = hasReferences
        ? new FormData()
        : JSON.stringify({
            model,
            prompt: imagePrompt,
            n: 1,
            size: "1024x1024",
            quality: "medium",
            output_format: "jpeg",
          });

      if (hasReferences && body instanceof FormData) {
        body.set("model", model);
        body.set("prompt", imagePrompt);
        body.set("n", "1");
        body.set("size", "1024x1024");
        body.set("quality", "medium");
        body.set("output_format", "jpeg");
        await appendReferenceImages(body, referenceImages);
      }

      const upstream = await fetch(
        `https://api.openai.com/v1/images/${hasReferences ? "edits" : "generations"}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            ...(hasReferences ? {} : { "Content-Type": "application/json" }),
          },
          body,
        },
      );

      const json = (await upstream.json().catch(() => null)) as OpenAIImageResponse | null;
      if (!upstream.ok) {
        throw new Error(json?.error?.message ?? `Could not generate ${variant.name}`);
      }

      const b64 = json?.data?.[0]?.b64_json;
      if (!b64) throw new Error(`${variant.name} returned no image`);

      return {
        id: variant.id,
        name: variant.name,
        role: variant.role,
        dataUrl: `data:image/jpeg;base64,${b64}`,
      };
    }),
  );
}
