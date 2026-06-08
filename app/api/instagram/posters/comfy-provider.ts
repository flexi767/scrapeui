import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import type { PosterVariantPrompt } from "@/lib/instagram/poster-variants";
import type { PosterImageModelConfig, PosterImageProvider } from "./model-config";
import {
  mimeFromFilename,
  mimeFromOutputFilename,
  type ReferenceImageRow,
} from "./reference-images";

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

type ComfyProviderMode = Extract<PosterImageProvider, "comfy-local" | "comfy-api">;

function getComfyBaseUrl(mode: ComfyProviderMode) {
  const baseUrl = mode === "comfy-api"
    ? process.env.COMFYUI_API_BASE_URL
    : process.env.COMFYUI_LOCAL_BASE_URL ?? process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188";
  if (!baseUrl) throw new Error("COMFYUI_API_BASE_URL is not configured");
  return baseUrl.replace(/\/+$/, "");
}

function getComfyTimeoutMs() {
  return Number(process.env.COMFYUI_TIMEOUT_MS ?? 180000);
}

function getComfyPollMs() {
  return Number(process.env.COMFYUI_POLL_MS ?? 1000);
}

function getComfyWorkflowPath(model: PosterImageModelConfig, mode: ComfyProviderMode) {
  const workflowPath = model.workflowPath
    ?? (mode === "comfy-api" ? process.env.COMFYUI_API_WORKFLOW_PATH : process.env.COMFYUI_LOCAL_WORKFLOW_PATH)
    ?? process.env.COMFYUI_WORKFLOW_PATH;
  if (!workflowPath) {
    throw new Error(
      mode === "comfy-api"
        ? "COMFYUI_API_WORKFLOW_PATH or COMFYUI_WORKFLOW_PATH is not configured"
        : "COMFYUI_LOCAL_WORKFLOW_PATH or COMFYUI_WORKFLOW_PATH is not configured",
    );
  }
  return path.isAbsolute(workflowPath) ? workflowPath : path.join(process.cwd(), workflowPath);
}

function getComfyHeaders(mode: ComfyProviderMode, headers?: HeadersInit): Headers {
  const nextHeaders = new Headers(headers);
  if (mode === "comfy-api" && process.env.COMFYUI_API_KEY) {
    nextHeaders.set("Authorization", `Bearer ${process.env.COMFYUI_API_KEY}`);
  }
  return nextHeaders;
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

async function uploadComfyImage(baseUrl: string, mode: ComfyProviderMode, image: ReferenceImageRow, variantId: string, index: number) {
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

  const response = await fetch(`${baseUrl}/upload/image`, {
    method: "POST",
    headers: getComfyHeaders(mode),
    body,
  });
  const json = (await response.json().catch(() => null)) as ComfyUploadedImage | null;
  if (!response.ok || !json?.name) {
    throw new Error(`Could not upload reference image to ComfyUI: ${response.status}`);
  }
  return json;
}

async function queueComfyPrompt(baseUrl: string, mode: ComfyProviderMode, workflow: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/prompt`, {
    method: "POST",
    headers: getComfyHeaders(mode, { "Content-Type": "application/json" }),
    body: JSON.stringify({ client_id: randomUUID(), prompt: workflow }),
  });
  const json = (await response.json().catch(() => null)) as ComfyPromptResponse | null;
  if (!response.ok || !json?.prompt_id) {
    throw new Error(`Could not queue ComfyUI prompt: ${JSON.stringify(json?.error ?? response.status)}`);
  }
  return json.prompt_id;
}

async function pollComfyHistory(baseUrl: string, mode: ComfyProviderMode, promptId: string) {
  const timeoutAt = Date.now() + getComfyTimeoutMs();
  while (Date.now() < timeoutAt) {
    const response = await fetch(`${baseUrl}/history/${encodeURIComponent(promptId)}`, {
      headers: getComfyHeaders(mode),
    });
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

async function readComfyOutputImage(baseUrl: string, mode: ComfyProviderMode, output: ComfyOutputImage) {
  const params = new URLSearchParams({
    filename: output.filename,
    type: output.type ?? "output",
  });
  if (output.subfolder) params.set("subfolder", output.subfolder);
  const response = await fetch(`${baseUrl}/view?${params.toString()}`, {
    headers: getComfyHeaders(mode),
  });
  if (!response.ok) throw new Error(`Could not read ComfyUI output image: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${mimeFromOutputFilename(output.filename)};base64,${bytes.toString("base64")}`;
}

export async function generateComfyPosterVariant({
  imagePrompt,
  model,
  mode,
  referenceImages,
  variant,
}: {
  imagePrompt: string;
  model: PosterImageModelConfig;
  mode: ComfyProviderMode;
  referenceImages: ReferenceImageRow[];
  variant: PosterVariantPrompt;
}) {
  const baseUrl = getComfyBaseUrl(mode);
  const uploadedImages = await Promise.all(
    referenceImages.map((image, index) => uploadComfyImage(baseUrl, mode, image, variant.id, index)),
  );
  const workflow = JSON.parse(await readFile(getComfyWorkflowPath(model, mode), "utf8")) as Record<string, unknown>;
  const patchedWorkflow = applyComfyWorkflowInputs(workflow, imagePrompt, uploadedImages);
  const promptId = await queueComfyPrompt(baseUrl, mode, patchedWorkflow);
  const outputs = await pollComfyHistory(baseUrl, mode, promptId);
  const output = getComfyOutputImage(outputs);
  if (!output) throw new Error(`${variant.name} returned no ComfyUI output image`);
  return readComfyOutputImage(baseUrl, mode, output);
}
