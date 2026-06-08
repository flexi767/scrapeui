import type { PosterVariantPrompt } from "@/lib/instagram/poster-variants";
import { appendReferenceImages, type ReferenceImageRow } from "./reference-images";

interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
}

export async function generateOpenAiPosterVariant({
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
