import { NextRequest } from "next/server";
import { raw } from "@/db/client";
import { requireAuth } from "@/lib/api/auth-helpers";
import { buildInstagramListingPayload } from "@/lib/instagram/listing-payload";
import { formatListingMileage, formatListingPrice } from "@/lib/listing-format";

export const runtime = "nodejs";
export const maxDuration = 60;

interface PosterRequestBody {
  backupId?: unknown;
  prompt?: unknown;
}

interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
}

function buildImagePrompt(
  listing: NonNullable<ReturnType<typeof buildInstagramListingPayload>>,
  prompt: string,
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
    "Asset type: Instagram square vehicle cover poster",
    `Primary request: ${prompt}`,
    `Subject: ${title}. ${specs.join(", ")}.`,
    "Style/medium: premium hyperrealistic automotive advertising poster, cinematic studio render, editorial car photography.",
    "Composition/framing: square 1:1 Instagram cover, dramatic vehicle hero angle, strong poster hierarchy, room for headline and offer details.",
    "Lighting/mood: cinematic reflections, polished surfaces, high-end dealership campaign.",
    "Text: include the vehicle make/model as a bold poster headline only if it can be rendered cleanly.",
    "Constraints: create a fully generated poster image, not a flat UI mockup or simple photo collage; no watermarks; no app chrome; no browser UI.",
    "Avoid: cheap flyer style, clutter, distorted car geometry, unreadable dense text, fake badges, extra logos.",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  if (!process.env.OPENAI_API_KEY) {
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

  const upstream = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.INSTAGRAM_POSTER_IMAGE_MODEL ?? "chatgpt-image-latest",
      prompt: buildImagePrompt(listing, prompt),
      n: 3,
      size: "1024x1024",
      quality: "medium",
      output_format: "jpeg",
    }),
  });

  const json = (await upstream.json().catch(() => null)) as OpenAIImageResponse | null;
  if (!upstream.ok) {
    return Response.json(
      { error: json?.error?.message ?? "Could not generate AI posters", variants: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const images =
    json?.data
      ?.map((item, index) =>
        item.b64_json
          ? {
              id: index === 0 ? "ai-hero" : index === 1 ? "ai-cinematic" : "ai-editorial",
              name: index === 0 ? "AI hero" : index === 1 ? "AI cinematic" : "AI editorial",
              dataUrl: `data:image/jpeg;base64,${item.b64_json}`,
            }
          : null,
      )
      .filter((item): item is { id: string; name: string; dataUrl: string } => Boolean(item)) ?? [];

  if (images.length === 0) {
    return Response.json(
      { error: "Image API returned no poster images", variants: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { variants: images },
    { headers: { "Cache-Control": "no-store" } },
  );
}
