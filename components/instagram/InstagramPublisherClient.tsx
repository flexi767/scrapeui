"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CopyIcon, DownloadIcon, InstagramIcon, RefreshCwIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";

interface InstagramListingPhoto {
  id: number;
  url: string;
  filename: string;
}

interface InstagramListingPayload {
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
  description: string;
  extras: string[];
  caption: string;
  photos: InstagramListingPhoto[];
}

interface PosterVariant {
  id: string;
  name: string;
  dataUrl: string;
}

interface Props {
  backupId: number;
}

const POSTER_SIZE = 1080;
const PROMPT_STORAGE_PREFIX = "scrapeui:instagram-poster-prompt:";

function formatPrice(price?: number) {
  return price == null ? "-" : `€${price.toLocaleString("en-US")}`;
}

function formatMileage(mileage?: number) {
  return mileage == null ? "-" : `${mileage.toLocaleString("en-US")} km`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = src;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const boxRatio = w / h;
  const sw = imageRatio > boxRatio ? image.naturalHeight * boxRatio : image.naturalWidth;
  const sh = imageRatio > boxRatio ? image.naturalHeight : image.naturalWidth / boxRatio;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = (image.naturalHeight - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function textFit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, weight = 800) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px Arial`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  } while (size > 30);
  return size;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
}

function drawSpec(ctx: CanvasRenderingContext2D, label: string, value: string, x: number, y: number, w: number) {
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

interface PosterDirection {
  accent: string;
  background: [string, string];
  compact: boolean;
  includeExtras: boolean;
  layout: "hero" | "grid" | "editorial";
  moodLabel: string;
  shotCount: number;
}

function buildDefaultPosterPrompt(listing: InstagramListingPayload) {
  const title = [listing.make, listing.model].filter(Boolean).join(" ") || listing.title;
  const extras = listing.extras.slice(0, 5).join(", ");
  return [
    "Create a premium square Instagram car-sale poster.",
    "Use clean dealership photography, a polished editorial layout, strong contrast, and no clutter.",
    `Hero car: ${title}.`,
    `Show important data: make, model, mileage ${formatMileage(listing.mileage)}, extras ${extras || "top options"}, price ${formatPrice(listing.price)}.`,
    "Use 2-3 cleaned shots, large readable typography, subtle luxury feel, and a clear price block.",
  ].join("\n");
}

function parsePosterPrompt(prompt: string, fallbackLayout: PosterDirection["layout"]): PosterDirection {
  const p = prompt.toLowerCase();
  const sporty = /\b(sport|dynamic|aggressive|bold|performance|fast)\b/.test(p);
  const luxury = /\b(luxury|premium|elegant|exclusive|high.?end)\b/.test(p);
  const clean = /\b(clean|minimal|simple|subtle|no clutter|declutter)\b/.test(p);
  const bright = /\b(bright|white|light|daylight|studio)\b/.test(p);
  const warm = /\b(warm|gold|bronze|champagne)\b/.test(p);
  const blue = /\b(blue|tech|electric|modern)\b/.test(p);
  const manyShots = /\b(three shot|triple|multiple|gallery|collage|grid)\b/.test(p);
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
        : sporty
          ? ["#151515", "#3a1f24"]
          : ["#14181f", "#26313a"];

  return {
    accent: warm ? "#f1c27d" : blue ? "#7dd3fc" : sporty ? "#fb7185" : luxury ? "#d7b56d" : "#f472b6",
    background,
    compact: clean,
    includeExtras: !/\b(no extras|hide extras|without extras)\b/.test(p),
    layout,
    moodLabel: sporty ? "Performance offer" : luxury ? "Premium offer" : clean ? "Clean offer" : "Featured offer",
    shotCount: singleShot ? 1 : manyShots ? 3 : 2,
  };
}

function makePoster(
  listing: InstagramListingPayload,
  images: HTMLImageElement[],
  variant: "hero" | "grid" | "editorial",
  prompt: string,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_SIZE;
  canvas.height = POSTER_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const direction = parsePosterPrompt(prompt, variant);
  const layout = direction.layout === variant ? variant : direction.layout;
  const title = [listing.make, listing.model].filter(Boolean).join(" ") || listing.title;
  const subtitle = listing.title.replace(title, "").trim();
  const specs = [
    ["Price", formatPrice(listing.price)],
    ["Mileage", formatMileage(listing.mileage)],
    ["Year", listing.year ? String(listing.year) : "-"],
    ["Fuel", listing.fuel ?? "-"],
  ] as const;

  const grad = ctx.createLinearGradient(0, 0, POSTER_SIZE, POSTER_SIZE);
  grad.addColorStop(0, direction.background[0]);
  grad.addColorStop(1, direction.background[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, POSTER_SIZE, POSTER_SIZE);

  const primary = images[0];
  if (layout === "grid") {
    const slots = [
      [48, 48, 640, 610],
      [716, 48, 316, 290],
      [716, 368, 316, 290],
    ] as const;
    slots.forEach(([x, y, w, h], index) => {
      if (index >= direction.shotCount) return;
      const image = images[index] ?? primary;
      if (!image) return;
      ctx.save();
      roundRect(ctx, x, y, w, h, 32);
      ctx.clip();
      drawCoverImage(ctx, image, x, y, w, h);
      ctx.restore();
    });
    ctx.fillStyle = "rgba(0,0,0,0.48)";
    ctx.fillRect(0, 662, POSTER_SIZE, 418);
  } else {
    if (primary) {
      ctx.save();
      roundRect(ctx, 48, 48, 984, layout === "hero" ? 640 : 570, 36);
      ctx.clip();
      drawCoverImage(ctx, primary, 48, 48, 984, layout === "hero" ? 640 : 570);
      ctx.restore();
    }
    if (layout === "editorial" && direction.shotCount > 1) {
      for (let index = 1; index < Math.min(images.length, direction.shotCount + 1); index += 1) {
        const x = 64 + (index - 1) * 318;
        ctx.save();
        roundRect(ctx, x, 640, 288, 168, 22);
        ctx.clip();
        drawCoverImage(ctx, images[index], x, 640, 288, 168);
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
  ctx.fillText(direction.moodLabel.toUpperCase(), 64, layout === "grid" ? 704 : 728);

  ctx.fillStyle = "#ffffff";
  const titleSize = textFit(ctx, title.toUpperCase(), 900, layout === "grid" ? 68 : 76);
  ctx.font = `900 ${titleSize}px Arial`;
  ctx.fillText(title.toUpperCase(), 64, layout === "grid" ? 760 : 784);

  if (subtitle && !direction.compact) {
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "700 30px Arial";
    drawWrappedText(ctx, subtitle, 66, layout === "grid" ? 808 : 832, 900, 38, 2);
  }

  const specY = layout === "grid" ? 878 : 884;
  specs.forEach(([label, value], index) => {
    drawSpec(ctx, label, value, 64 + (index % 2) * 486, specY + Math.floor(index / 2) * 106, 448);
  });

  const extras = listing.extras.slice(0, 4).join("  /  ");
  if (extras && direction.includeExtras) {
    ctx.fillStyle = "rgba(255,255,255,0.64)";
    ctx.font = "700 24px Arial";
    drawWrappedText(ctx, extras, 66, 1042, 930, 30, 1);
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

function dataUrlToFile(dataUrl: string, filename: string) {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

async function imageUrlToFile(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch ${filename}`);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

export function InstagramPublisherClient({ backupId }: Props) {
  const [listing, setListing] = useState<InstagramListingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants] = useState<PosterVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("hero");
  const [posterPrompt, setPosterPrompt] = useState("");
  const [sharing, setSharing] = useState(false);
  const canvasSeedRef = useRef(0);
  const initialPosterGeneratedRef = useRef(false);

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? variants[0],
    [selectedVariantId, variants],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/instagram/listings/${backupId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load listing");
        return data as InstagramListingPayload;
      })
      .then((data) => {
        if (!cancelled) {
          setListing(data);
          initialPosterGeneratedRef.current = false;
          const savedPrompt = window.localStorage.getItem(`${PROMPT_STORAGE_PREFIX}${data.backupId}`);
          setPosterPrompt(savedPrompt || buildDefaultPosterPrompt(data));
        }
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load listing"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [backupId]);

  const generatePosters = useCallback(async () => {
    if (!listing) return;
    const prompt = posterPrompt.trim() || buildDefaultPosterPrompt(listing);
    window.localStorage.setItem(`${PROMPT_STORAGE_PREFIX}${listing.backupId}`, prompt);
    const seed = canvasSeedRef.current + 1;
    canvasSeedRef.current = seed;
    setGenerating(true);
    try {
      const loaded = await Promise.all(listing.photos.slice(0, 5).map((photo) => loadImage(photo.url)));
      if (canvasSeedRef.current !== seed) return;
      setVariants([
        { id: "hero", name: "Hero poster", dataUrl: makePoster(listing, loaded, "hero", prompt) },
        { id: "grid", name: "Triple shot", dataUrl: makePoster(listing, loaded, "grid", prompt) },
        { id: "editorial", name: "Clean gallery", dataUrl: makePoster(listing, loaded, "editorial", prompt) },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate posters");
    } finally {
      if (canvasSeedRef.current === seed) setGenerating(false);
    }
  }, [listing, posterPrompt]);

  useEffect(() => {
    if (!listing || !posterPrompt || initialPosterGeneratedRef.current) return;
    initialPosterGeneratedRef.current = true;
    void generatePosters();
  }, [generatePosters, listing, posterPrompt]);

  function resetPosterPrompt() {
    if (!listing) return;
    const nextPrompt = buildDefaultPosterPrompt(listing);
    setPosterPrompt(nextPrompt);
    window.localStorage.removeItem(`${PROMPT_STORAGE_PREFIX}${listing.backupId}`);
  }

  async function copyCaption() {
    if (!listing) return;
    await navigator.clipboard.writeText(listing.caption);
    toast.success("Caption copied");
  }

  function downloadCover() {
    if (!selectedVariant) return;
    const link = document.createElement("a");
    link.href = selectedVariant.dataUrl;
    link.download = `instagram-cover-${backupId}-${selectedVariant.id}.jpg`;
    link.click();
  }

  async function shareCarousel() {
    if (!listing || !selectedVariant) return;
    setSharing(true);
    try {
      const files = [
        dataUrlToFile(selectedVariant.dataUrl, `cover-${backupId}.jpg`),
        ...(await Promise.all(
          listing.photos.map((photo, index) =>
            imageUrlToFile(photo.url, `${String(index + 2).padStart(2, "0")}-${photo.filename}`),
          ),
        )),
      ];

      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
      };
      if (!nav.share || (nav.canShare && !nav.canShare({ files }))) {
        throw new Error("This browser cannot share multiple image files directly.");
      }

      await nav.share({
        title: listing.title,
        text: listing.caption,
        files,
      });
      toast.success("Share sheet opened");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open share sheet");
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-gray-300">Loading Instagram publisher...</div>;
  }

  if (!listing) {
    return <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-6 text-red-100">Listing could not be loaded.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/editown" className="text-sm text-gray-400 hover:text-white">
            Back to own listings
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Instagram publish</h1>
          <p className="mt-1 text-sm text-gray-400">{listing.title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyCaption}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-700 px-3 text-sm text-gray-100 hover:bg-gray-800"
          >
            <CopyIcon className="h-4 w-4" />
            Copy caption
          </button>
          <button
            type="button"
            onClick={downloadCover}
            disabled={!selectedVariant}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-700 px-3 text-sm text-gray-100 hover:bg-gray-800 disabled:opacity-50"
          >
            <DownloadIcon className="h-4 w-4" />
            Cover
          </button>
          <button
            type="button"
            onClick={shareCarousel}
            disabled={!selectedVariant || sharing}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-pink-600 px-3 text-sm font-medium text-white hover:bg-pink-500 disabled:opacity-50"
          >
            <SendIcon className="h-4 w-4" />
            {sharing ? "Preparing..." : "Share carousel"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_420px]">
        <section className="space-y-4">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Poster prompt</h2>
                <p className="mt-1 text-xs text-gray-500">
                  The prompt steers the poster layout, palette, shot count, and visible highlights.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetPosterPrompt}
                  className="inline-flex h-8 items-center rounded-md border border-gray-700 px-3 text-xs text-gray-200 hover:bg-gray-800"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => void generatePosters()}
                  disabled={generating}
                  className="inline-flex h-8 items-center gap-2 rounded-md bg-pink-600 px-3 text-xs font-medium text-white hover:bg-pink-500 disabled:opacity-50"
                >
                  <RefreshCwIcon className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
                  Generate posters
                </button>
              </div>
            </div>
            <textarea
              value={posterPrompt}
              onChange={(event) => setPosterPrompt(event.target.value)}
              rows={6}
              className="w-full resize-y rounded-md border border-gray-700 bg-gray-950 p-3 text-sm leading-6 text-gray-200 outline-none focus:border-pink-400"
            />
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Choose cover</h2>
            <button
              type="button"
              onClick={() => void generatePosters()}
              disabled={generating}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-gray-700 px-3 text-xs text-gray-200 hover:bg-gray-800 disabled:opacity-50"
            >
              <RefreshCwIcon className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
              Regenerate
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {variants.map((variant) => (
              <button
                type="button"
                key={variant.id}
                onClick={() => setSelectedVariantId(variant.id)}
                className={`overflow-hidden rounded-lg border bg-gray-900 text-left transition ${
                  selectedVariantId === variant.id
                    ? "border-pink-400 ring-2 ring-pink-400/30"
                    : "border-gray-800 hover:border-gray-600"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={variant.dataUrl} alt={variant.name} className="aspect-square w-full object-cover" />
                <div className="px-3 py-2 text-sm font-medium text-white">{variant.name}</div>
              </button>
            ))}
            {variants.length === 0 && (
              <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-sm text-gray-400">
                {generating ? "Generating poster options..." : "No poster options yet."}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Carousel order</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {selectedVariant && (
                <div className="w-36 shrink-0 overflow-hidden rounded-lg border border-pink-400 bg-gray-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedVariant.dataUrl} alt="Selected cover" className="aspect-square w-full object-cover" />
                  <div className="px-2 py-1 text-xs text-pink-100">1. Cover</div>
                </div>
              )}
              {listing.photos.map((photo, index) => (
                <a
                  key={photo.id}
                  href={photo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-36 shrink-0 overflow-hidden rounded-lg border border-gray-800 bg-gray-900 hover:border-gray-600"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={`Photo ${index + 1}`} className="aspect-square w-full object-cover" />
                  <div className="px-2 py-1 text-xs text-gray-300">{index + 2}. Photo</div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <InstagramIcon className="h-4 w-4 text-pink-300" />
              Post data
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-gray-800 px-3 py-2">
                <div className="text-xs text-gray-500">Make</div>
                <div className="text-gray-100">{listing.make ?? "-"}</div>
              </div>
              <div className="rounded-md bg-gray-800 px-3 py-2">
                <div className="text-xs text-gray-500">Model</div>
                <div className="text-gray-100">{listing.model ?? "-"}</div>
              </div>
              <div className="rounded-md bg-gray-800 px-3 py-2">
                <div className="text-xs text-gray-500">Mileage</div>
                <div className="text-gray-100">{formatMileage(listing.mileage)}</div>
              </div>
              <div className="rounded-md bg-gray-800 px-3 py-2">
                <div className="text-xs text-gray-500">Price</div>
                <div className="text-gray-100">{formatPrice(listing.price)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Caption</h2>
            <textarea
              value={listing.caption}
              readOnly
              rows={16}
              className="w-full resize-y rounded-md border border-gray-700 bg-gray-950 p-3 text-sm leading-6 text-gray-200"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
