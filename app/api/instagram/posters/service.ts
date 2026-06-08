import { readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { buildInstagramListingPayload } from "@/lib/instagram/listing-payload";
import {
  parsePosterCollageSelections,
  parsePosterVariantPrompts,
  type CollageSelections,
  type PosterVariantPrompt,
} from "@/lib/instagram/poster-variants";
import { formatListingMileage, formatListingPrice } from "@/lib/listing-format";
import {
  getPosterImageProvider,
  type PosterImageModelConfig,
  type PosterImageProvider,
} from "./model-config";
import {
  appendReferenceImages,
  getReferenceImages,
  mimeFromFilename,
  mimeFromOutputFilename,
  type ReferenceImageRow,
} from "./reference-images";
export {
  getPosterImageModelOptions,
  getPosterImageProvider,
  getPosterImageProviderOptions,
  resolvePosterImageModel,
  validatePosterImageProvider,
  type PosterImageModelOption,
  type PosterImageProvider,
} from "./model-config";

export interface PosterRequestBody {
  backupId?: unknown;
  prompt?: unknown;
  force?: unknown;
  cacheOnly?: unknown;
  variantId?: unknown;
  variantPrompts?: unknown;
  collageSelections?: unknown;
  imageProvider?: unknown;
  imageModel?: unknown;
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

interface ComfyUploadedImage {
  name: string;
  subfolder?: string;
  type?: string;
}

interface ComfyPromptResponse {
  prompt_id?: string;
  error?: unknown;
}

interface ComfyHistoryResponse {
  [promptId: string]: {
    outputs?: Record<
      string,
      {
        images?: Array<{
          filename?: string;
          subfolder?: string;
          type?: string;
        }>;
      }
    >;
  };
}

interface ComfyOutputImage {
  filename: string;
  subfolder?: string;
  type?: string;
}

export function parseVariantPrompts(raw: unknown) {
  return parsePosterVariantPrompts(raw);
}

export function parseVariantId(raw: unknown) {
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function parseCollageSelections(raw: unknown) {
  return parsePosterCollageSelections(raw);
}

export function parseImageProvider(raw: unknown) {
  return typeof raw === "string" && raw.trim() ? getPosterImageProvider(raw) : getPosterImageProvider();
}

export function parseImageModel(raw: unknown) {
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
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
    "Text: do not render any letters, words, captions, contact details, logos, typography, footer text, or UI labels. All text will be added later with a consistent font.",
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

function getComfyBaseUrl() {
  return (process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188").replace(/\/+$/, "");
}

function getComfyTimeoutMs() {
  return Number(process.env.COMFYUI_TIMEOUT_MS ?? 180000);
}

function getComfyPollMs() {
  return Number(process.env.COMFYUI_POLL_MS ?? 1000);
}

function getComfyWorkflowPath(model: PosterImageModelConfig) {
  const workflowPath = model.workflowPath ?? process.env.COMFYUI_WORKFLOW_PATH;
  if (!workflowPath) throw new Error("COMFYUI_WORKFLOW_PATH is not configured");
  return path.isAbsolute(workflowPath) ? workflowPath : path.join(process.cwd(), workflowPath);
}

function parseComfyReferenceNodeIds() {
  return (process.env.COMFYUI_REFERENCE_IMAGE_NODE_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function setWorkflowPlaceholders(value: unknown, replacements: Record<string, string>): unknown {
  if (typeof value === "string") {
    return replacements[value] ?? value;
  }
  if (Array.isArray(value)) return value.map((item) => setWorkflowPlaceholders(item, replacements));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, setWorkflowPlaceholders(item, replacements)]),
  );
}

function applyComfyWorkflowInputs(
  workflow: Record<string, unknown>,
  prompt: string,
  referenceImages: ComfyUploadedImage[],
) {
  const positiveNodeId = process.env.COMFYUI_POSITIVE_PROMPT_NODE_ID;
  const positiveInputName = process.env.COMFYUI_POSITIVE_PROMPT_INPUT ?? "text";
  const referenceInputName = process.env.COMFYUI_REFERENCE_IMAGE_INPUT ?? "image";
  const referenceNodeIds = parseComfyReferenceNodeIds();
  const referenceNames = referenceImages.map((image) => [image.subfolder, image.name].filter(Boolean).join("/"));
  const replacements: Record<string, string> = {
    "{{PROMPT}}": prompt,
    "{{POSITIVE_PROMPT}}": prompt,
  };

  referenceNames.forEach((name, index) => {
    replacements[`{{REFERENCE_IMAGE_${index + 1}}}`] = name;
  });

  const patched = setWorkflowPlaceholders(workflow, replacements) as Record<string, unknown>;

  if (positiveNodeId) {
    const node = patched[positiveNodeId] as { inputs?: Record<string, unknown> } | undefined;
    if (!node?.inputs) throw new Error(`ComfyUI workflow node ${positiveNodeId} was not found`);
    node.inputs[positiveInputName] = prompt;
  }

  referenceNodeIds.forEach((nodeId, index) => {
    const imageName = referenceNames[index] ?? referenceNames[0];
    if (!imageName) return;
    const node = patched[nodeId] as { inputs?: Record<string, unknown> } | undefined;
    if (!node?.inputs) throw new Error(`ComfyUI workflow node ${nodeId} was not found`);
    node.inputs[referenceInputName] = imageName;
  });

  return patched;
}

async function uploadComfyImage(baseUrl: string, image: ReferenceImageRow, variantId: string, index: number) {
  if (!image.local_path) throw new Error("Reference image has no local path");
  const bytes = await readFile(image.local_path);
  const originalName = image.filename || path.basename(image.local_path);
  const ext = path.extname(originalName) || ".jpg";
  const filename = `scrapeui-${variantId}-${image.id}-${index + 1}${ext}`;
  const file = new File([bytes], filename, { type: mimeFromFilename(originalName, image.local_path) });
  const body = new FormData();
  body.set("image", file);
  body.set("type", "input");
  body.set("overwrite", "true");

  const response = await fetch(`${baseUrl}/upload/image`, { method: "POST", body });
  const json = (await response.json().catch(() => null)) as ComfyUploadedImage | null;
  if (!response.ok || !json?.name) {
    throw new Error(`Could not upload reference image to ComfyUI: ${response.status}`);
  }
  return json;
}

async function queueComfyPrompt(baseUrl: string, workflow: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: randomUUID(), prompt: workflow }),
  });
  const json = (await response.json().catch(() => null)) as ComfyPromptResponse | null;
  if (!response.ok || !json?.prompt_id) {
    throw new Error(`Could not queue ComfyUI prompt: ${JSON.stringify(json?.error ?? response.status)}`);
  }
  return json.prompt_id;
}

async function pollComfyHistory(baseUrl: string, promptId: string) {
  const timeoutAt = Date.now() + getComfyTimeoutMs();
  while (Date.now() < timeoutAt) {
    const response = await fetch(`${baseUrl}/history/${encodeURIComponent(promptId)}`);
    const json = (await response.json().catch(() => null)) as ComfyHistoryResponse | null;
    const history = json?.[promptId];
    if (history?.outputs) return history.outputs;
    await new Promise((resolve) => setTimeout(resolve, getComfyPollMs()));
  }
  throw new Error("ComfyUI generation timed out");
}

function getComfyOutputImage(
  outputs: NonNullable<ComfyHistoryResponse[string]["outputs"]>,
): ComfyOutputImage | null {
  const outputNodeId = process.env.COMFYUI_OUTPUT_NODE_ID;
  const nodes = outputNodeId ? [outputs[outputNodeId]] : Object.values(outputs);
  for (const node of nodes) {
    const image = node?.images?.[0];
    if (image?.filename) {
      return {
        filename: image.filename,
        subfolder: image.subfolder,
        type: image.type,
      };
    }
  }
  return null;
}

async function readComfyOutputImage(baseUrl: string, output: ComfyOutputImage) {
  const params = new URLSearchParams({
    filename: output.filename,
    type: output.type ?? "output",
  });
  if (output.subfolder) params.set("subfolder", output.subfolder);
  const response = await fetch(`${baseUrl}/view?${params.toString()}`);
  if (!response.ok) throw new Error(`Could not read ComfyUI output image: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${mimeFromOutputFilename(output.filename)};base64,${bytes.toString("base64")}`;
}

async function generateComfyPosterVariant({
  imagePrompt,
  model,
  referenceImages,
  variant,
}: {
  imagePrompt: string;
  model: PosterImageModelConfig;
  referenceImages: ReferenceImageRow[];
  variant: PosterVariantPrompt;
}) {
  const baseUrl = getComfyBaseUrl();
  const uploadedImages = await Promise.all(
    referenceImages.map((image, index) => uploadComfyImage(baseUrl, image, variant.id, index)),
  );
  const workflow = JSON.parse(await readFile(getComfyWorkflowPath(model), "utf8")) as Record<string, unknown>;
  const patchedWorkflow = applyComfyWorkflowInputs(workflow, imagePrompt, uploadedImages);
  const promptId = await queueComfyPrompt(baseUrl, patchedWorkflow);
  const outputs = await pollComfyHistory(baseUrl, promptId);
  const output = getComfyOutputImage(outputs);
  if (!output) throw new Error(`${variant.name} returned no ComfyUI output image`);
  return readComfyOutputImage(baseUrl, output);
}

async function generateOpenAiPosterVariant({
  imagePrompt,
  model,
  apiKey,
  referenceImages,
  variant,
}: {
  imagePrompt: string;
  model: string;
  apiKey: string;
  referenceImages: ReferenceImageRow[];
  variant: PosterVariantPrompt;
}) {
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
  return `data:image/jpeg;base64,${b64}`;
}

export async function generatePosterVariants({
  listing,
  prompt,
  model,
  provider,
  variantPrompts,
  collageSelections,
}: {
  listing: NonNullable<ReturnType<typeof buildInstagramListingPayload>>;
  prompt: string;
  model: PosterImageModelConfig;
  provider: PosterImageProvider;
  variantPrompts: PosterVariantPrompt[];
  collageSelections: CollageSelections;
}) {
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  return Promise.all(
    variantPrompts.map(async (variant) => {
      const imagePrompt = buildImagePrompt(listing, prompt, variant);
      const referenceImages = getReferenceImages(getVariantPhotoIds(listing, variant.id, collageSelections));
      const dataUrl =
        provider === "comfyui"
          ? await generateComfyPosterVariant({ imagePrompt, model, referenceImages, variant })
          : await generateOpenAiPosterVariant({ imagePrompt, model: model.id, apiKey, referenceImages, variant });

      return {
        id: variant.id,
        name: variant.name,
        role: variant.role,
        dataUrl,
      };
    }),
  );
}
