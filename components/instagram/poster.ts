import { drawCoverImage, drawWrappedText } from "@/lib/canvas-utils";
import { formatListingMileage, formatListingPrice } from "@/lib/listing-format";
export {
  COLLAGE_SELECTION_STORAGE_PREFIX,
  DEFAULT_POSTER_VARIANT_PROMPTS,
  PROMPT_STORAGE_PREFIX,
  VARIANT_PROMPT_STORAGE_PREFIX,
  type CollageSelections,
  type PosterVariantPrompt,
} from "@/lib/instagram/poster-variants";

export { formatListingPrice as formatPosterPrice, formatListingMileage as formatPosterMileage };

export interface InstagramListingPhoto {
  id: number;
  url: string;
  filename: string;
}

export interface InstagramListingPayload {
  backupId: number;
  title: string;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  price?: number;
  fuel?: string;
  transmission?: string;
  color?: string;
  power?: number;
  bodyType?: string;
  city?: string;
  phone?: string;
  description: string;
  extras: string[];
  caption: string;
  photos: InstagramListingPhoto[];
}

export interface PosterVariant {
  id: string;
  name: string;
  role?: "cover" | "collage";
  dataUrl: string;
}

export const POSTER_SIZE = 1080;

interface PosterDirection {
  accent: string;
  background: [string, string];
  compact: boolean;
  includeExtras: boolean;
  layout: "hero" | "grid" | "editorial";
  moodLabel: string;
  shotCount: number;
}

function hashText(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function pickImages<T>(items: T[], seed: number) {
  const random = seededRandom(seed);
  return [...items]
    .map((item) => ({ item, sort: random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

function jitter(random: () => number, amount: number) {
  return (random() - 0.5) * amount;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function textFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  weight = 800,
) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px Arial`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  } while (size > 30);
  return size;
}

function drawSpec(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number,
) {
  ctx.fillStyle = "rgba(255,255,255,0.09)";
  roundRect(ctx, x, y, w, 92, 18);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.68)";
  ctx.font = "700 24px Arial";
  ctx.fillText(label.toUpperCase(), x + 24, y + 34);
  ctx.fillStyle = "#ffffff";
  const size = textFit(ctx, value, w - 48, 34);
  ctx.font = `800 ${size}px Arial`;
  ctx.fillText(value, x + 24, y + 72);
}

export function buildDefaultPosterPrompt(listing: InstagramListingPayload) {
  const carBrand = listing.make || "Premium";
  const carModel = listing.model || "Vehicle";
  const description =
    listing.description ||
    "Exceptional performance and luxury in one stunning package.";
  const mainColor = listing.color || "silver";

  return `A hyperrealistic vertical poster showcasing a premium vehicle. The subject is defined by ${carBrand} and its model ${carModel}. At the top of the composition, a dynamic top-down render of this specific car appears in motion under cinematic lighting. A large architectural headline spelling the brand overlaps the upper half of the car by 30–50%, cleanly integrated into the layout. Above the title, aligned left, the model name appears in smaller uppercase text.

The central section features a glossy side-profile render of the same vehicle, placed prominently in the middle. To the right, two smaller insets show close-up rear and angled front views. Below, a centered model label is followed by a short description block: ${description}.

The full poster design follows a unified ${mainColor} visual palette that influences all lighting, reflections, accents, and background tones. The overall aesthetic is inspired by high-end editorial car photography, with crisp detailing, modern poster hierarchy, and cinematic framing. Poster aspect ratio is always 2:3.`;
}

function parsePosterPrompt(
  prompt: string,
  fallbackLayout: PosterDirection["layout"],
): PosterDirection {
  const p = prompt.toLowerCase();
  const sporty = /\b(sport|aggressive|bold|performance|fast)\b/.test(p);
  const luxury = /\b(luxury|premium|elegant|exclusive|high.?end)\b/.test(p);
  const clean = /\b(clean|minimal|simple|subtle|no clutter|declutter)\b/.test(
    p,
  );
  const bright = /\b(bright|white|light|daylight|studio)\b/.test(p);
  const warm = /\b(warm|gold|bronze|champagne)\b/.test(p);
  const blue = /\b(blue|tech|electric|modern)\b/.test(p);
  const silver = /\b(silver|chrome|gray|grey|metallic|neutral)\b/.test(p);
  const manyShots =
    /\b(three shot|triple|multiple|gallery|collage|grid)\b/.test(p);
  const singleShot = /\b(single|one shot|hero only)\b/.test(p);

  const layout: PosterDirection["layout"] = manyShots
    ? "grid"
    : singleShot
      ? "hero"
      : /\b(editorial|magazine)\b/.test(p)
        ? "editorial"
        : fallbackLayout;

  const background: [string, string] = bright
    ? ["#f3f4f0", "#d7d9d2"]
    : warm
      ? ["#191714", "#4a3b28"]
      : blue
        ? ["#111820", "#244052"]
        : silver
          ? ["#101318", "#4b5563"]
          : sporty
            ? ["#151515", "#3a1f24"]
            : luxury
              ? ["#14120f", "#2f2a20"]
              : ["#14181f", "#26313a"];

  return {
    accent: warm
      ? "#f1c27d"
      : blue
        ? "#7dd3fc"
        : silver
          ? "#d1d5db"
          : sporty
            ? "#fb7185"
            : luxury
              ? "#d7b56d"
              : "#f472b6",
    background,
    compact: clean,
    includeExtras: !/\b(no extras|hide extras|without extras)\b/.test(p),
    layout,
    moodLabel: sporty
      ? "Performance offer"
      : luxury
        ? "Premium offer"
        : clean
          ? "Clean offer"
          : "Featured offer",
    shotCount: singleShot ? 1 : manyShots ? 3 : 2,
  };
}

export function makePoster(
  listing: InstagramListingPayload,
  images: HTMLImageElement[],
  variant: "hero" | "grid" | "editorial",
  prompt: string,
  seed = 0,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_SIZE;
  canvas.height = POSTER_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const direction = parsePosterPrompt(prompt, variant);
  const layout = direction.layout === variant ? variant : direction.layout;
  const random = seededRandom(hashText(`${prompt}:${variant}:${seed}`));
  const orderedImages = seed ? pickImages(images, hashText(`${variant}:${seed}`)) : images;
  const title =
    [listing.make, listing.model].filter(Boolean).join(" ") || listing.title;
  const subtitle = listing.title.replace(title, "").trim();
  const specs = [
    ["Price", formatListingPrice(listing.price)],
    ["Mileage", formatListingMileage(listing.mileage)],
    ["Year", listing.year ? String(listing.year) : "-"],
    ["Fuel", listing.fuel ?? "-"],
  ] as const;

  const grad = ctx.createLinearGradient(0, 0, POSTER_SIZE, POSTER_SIZE);
  grad.addColorStop(0, direction.background[0]);
  grad.addColorStop(1, direction.background[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, POSTER_SIZE, POSTER_SIZE);

  const primary = orderedImages[0] ?? images[0];
  if (layout === "grid") {
    const slots = [
      [48, 48, 640, 610],
      [716, 48, 316, 290],
      [716, 368, 316, 290],
    ] as const;
    slots.forEach(([x, y, w, h], index) => {
      if (index >= direction.shotCount) return;
      const image = orderedImages[index] ?? primary;
      if (!image) return;
      ctx.save();
      roundRect(ctx, x, y, w, h, 32);
      ctx.clip();
      drawCoverImage(
        ctx,
        image,
        x,
        y,
        w,
        h,
        1 + random() * 0.08,
        jitter(random, 0.28),
        jitter(random, 0.18),
      );
      ctx.restore();
    });
    ctx.fillStyle = "rgba(0,0,0,0.48)";
    ctx.fillRect(0, 662, POSTER_SIZE, 418);
  } else {
    if (primary) {
      ctx.save();
      roundRect(ctx, 48, 48, 984, layout === "hero" ? 640 : 570, 36);
      ctx.clip();
      drawCoverImage(
        ctx,
        primary,
        48,
        48,
        984,
        layout === "hero" ? 640 : 570,
        1 + random() * 0.1,
        jitter(random, 0.32),
        jitter(random, 0.2),
      );
      ctx.restore();
    }
    if (layout === "editorial" && direction.shotCount > 1) {
      for (
        let index = 1;
        index < Math.min(orderedImages.length, direction.shotCount + 1);
        index += 1
      ) {
        const x = 64 + (index - 1) * 318;
        ctx.save();
        roundRect(ctx, x, 640, 288, 168, 22);
        ctx.clip();
        drawCoverImage(
          ctx,
          orderedImages[index],
          x,
          640,
          288,
          168,
          1 + random() * 0.06,
          jitter(random, 0.24),
          jitter(random, 0.16),
        );
        ctx.restore();
      }
    }
    const overlay = ctx.createLinearGradient(0, 600, 0, POSTER_SIZE);
    overlay.addColorStop(0, "rgba(0,0,0,0)");
    overlay.addColorStop(0.35, "rgba(0,0,0,0.62)");
    overlay.addColorStop(1, "rgba(0,0,0,0.88)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 520, POSTER_SIZE, 560);
  }

  ctx.fillStyle = direction.accent;
  ctx.font = "800 24px Arial";
  ctx.fillText(
    direction.moodLabel.toUpperCase(),
    64,
    layout === "grid" ? 704 : 728,
  );

  ctx.fillStyle = "#ffffff";
  const titleSize = textFit(
    ctx,
    title.toUpperCase(),
    900,
    layout === "grid" ? 68 : 76,
  );
  ctx.font = `900 ${titleSize}px Arial`;
  ctx.fillText(title.toUpperCase(), 64, layout === "grid" ? 760 : 784);

  if (subtitle && !direction.compact) {
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "700 30px Arial";
    drawWrappedText(
      ctx,
      subtitle,
      66,
      layout === "grid" ? 808 : 832,
      900,
      38,
      2,
    );
  }

  const specY = layout === "grid" ? 878 : 884;
  specs.forEach(([label, value], index) => {
    drawSpec(
      ctx,
      label,
      value,
      64 + (index % 2) * 486,
      specY + Math.floor(index / 2) * 106,
      448,
    );
  });

  const extras = listing.extras.slice(0, 4).join("  /  ");
  if (extras && direction.includeExtras) {
    ctx.fillStyle = "rgba(255,255,255,0.64)";
    ctx.font = "700 24px Arial";
    drawWrappedText(ctx, extras, 66, 1042, 930, 30, 1);
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

export function dataUrlToFile(dataUrl: string, filename: string) {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

export async function imageUrlToFile(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch ${filename}`);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}
