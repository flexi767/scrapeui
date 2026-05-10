export interface TikTokVideoListingPhoto {
  id: number;
  url: string;
  filename: string;
}

export interface TikTokVideoListingPayload {
  backupId: number;
  title: string;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  price?: number;
  fuel?: string;
  transmission?: string;
  power?: number;
  description: string;
  extras: string[];
  caption: string;
  photos: TikTokVideoListingPhoto[];
}

export interface RenderedTikTokVideo {
  blob: Blob;
  url: string;
  filename: string;
}

export const TIKTOK_VIDEO_WIDTH = 720;
export const TIKTOK_VIDEO_HEIGHT = 1280;
export const TIKTOK_VIDEO_LENGTH_MS = 15000;

const FPS = 30;

export function formatTikTokPrice(price?: number) {
  return price == null ? "-" : `€${price.toLocaleString("en-US")}`;
}

export function formatTikTokMileage(mileage?: number) {
  return mileage == null ? "-" : `${mileage.toLocaleString("en-US")} km`;
}

export function buildDefaultTikTokCaption(listing: TikTokVideoListingPayload) {
  const title = [listing.make, listing.model].filter(Boolean).join(" ") || listing.title;
  const tags = [
    "#cars",
    "#carsoftiktok",
    "#forsale",
    listing.make ? `#${listing.make.replace(/\W+/g, "")}` : null,
    listing.fuel ? `#${listing.fuel.replace(/\W+/g, "")}` : null,
  ].filter(Boolean);

  return [
    `${title} for sale`,
    `${formatTikTokMileage(listing.mileage)} • ${listing.year ?? "-"} • ${formatTikTokPrice(listing.price)}`,
    listing.extras.slice(0, 5).join(" • "),
    tags.join(" "),
  ]
    .filter(Boolean)
    .join("\n");
}

function loadImage(src: string, signal: AbortSignal) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Video rendering was cancelled", "AbortError"));
      return;
    }

    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load listing photo"));
    image.src = src;

    signal.addEventListener(
      "abort",
      () => {
        image.src = "";
        reject(new DOMException("Video rendering was cancelled", "AbortError"));
      },
      { once: true },
    );
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  zoom = 1,
  panX = 0,
  panY = 0,
) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const boxRatio = w / h;
  let sw = imageRatio > boxRatio ? image.naturalHeight * boxRatio : image.naturalWidth;
  let sh = imageRatio > boxRatio ? image.naturalHeight : image.naturalWidth / boxRatio;
  sw /= zoom;
  sh /= zoom;
  const sx = Math.max(
    0,
    Math.min(image.naturalWidth - sw, (image.naturalWidth - sw) / 2 + panX * (image.naturalWidth - sw) * 0.5),
  );
  const sy = Math.max(
    0,
    Math.min(image.naturalHeight - sh, (image.naturalHeight - sh) / 2 + panY * (image.naturalHeight - sh) * 0.5),
  );
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
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

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number) {
  let size = startSize;
  while (size > 34) {
    ctx.font = `900 ${size}px Arial`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  return size;
}

function getRecorderMimeType() {
  const preferred = [
    "video/mp4;codecs=h264",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return preferred.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  listing: TikTokVideoListingPayload,
  images: HTMLImageElement[],
  progress: number,
) {
  const title = [listing.make, listing.model].filter(Boolean).join(" ") || listing.title;
  const subtitle = [
    listing.year,
    formatTikTokMileage(listing.mileage),
    listing.fuel,
    listing.transmission,
  ].filter((item) => item && item !== "-").join("  /  ");
  const activeIndex = Math.min(images.length - 1, Math.floor(progress * images.length));
  const localProgress = (progress * images.length) % 1;
  const image = images[activeIndex] ?? images[0];

  ctx.fillStyle = "#08090d";
  ctx.fillRect(0, 0, TIKTOK_VIDEO_WIDTH, TIKTOK_VIDEO_HEIGHT);

  if (image) {
    drawCoverImage(
      ctx,
      image,
      0,
      0,
      TIKTOK_VIDEO_WIDTH,
      TIKTOK_VIDEO_HEIGHT,
      1 + localProgress * 0.08,
      activeIndex % 2 === 0 ? -0.16 + localProgress * 0.32 : 0.16 - localProgress * 0.32,
      0,
    );
  }

  const shade = ctx.createLinearGradient(0, 0, 0, TIKTOK_VIDEO_HEIGHT);
  shade.addColorStop(0, "rgba(0,0,0,0.45)");
  shade.addColorStop(0.42, "rgba(0,0,0,0.03)");
  shade.addColorStop(0.7, "rgba(0,0,0,0.25)");
  shade.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, TIKTOK_VIDEO_WIDTH, TIKTOK_VIDEO_HEIGHT);

  ctx.fillStyle = "#ffffff";
  const titleSize = fitFont(ctx, title.toUpperCase(), 600, 56);
  ctx.font = `900 ${titleSize}px Arial`;
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 14;
  drawWrappedText(ctx, title.toUpperCase(), 44, 830, 632, titleSize + 8, 2);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#67e8f9";
  ctx.font = "900 46px Arial";
  ctx.fillText(formatTikTokPrice(listing.price), 44, 990);

  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = "700 28px Arial";
  drawWrappedText(ctx, subtitle, 46, 1046, 620, 38, 2);

  const extras = listing.extras.slice(0, 3).join("  •  ");
  if (extras) {
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "700 24px Arial";
    drawWrappedText(ctx, extras, 46, 1152, 620, 34, 2);
  }

  ctx.fillStyle = "rgba(255,255,255,0.36)";
  ctx.fillRect(44, 1218, 632, 5);
  ctx.fillStyle = "#f472b6";
  ctx.fillRect(44, 1218, Math.max(18, 632 * progress), 5);
}

export async function renderTikTokVideo({
  listing,
  caption,
  signal,
  onPreview,
}: {
  listing: TikTokVideoListingPayload;
  caption: string;
  signal: AbortSignal;
  onPreview: (dataUrl: string) => void;
}): Promise<RenderedTikTokVideo> {
  const canvas = document.createElement("canvas");
  canvas.width = TIKTOK_VIDEO_WIDTH;
  canvas.height = TIKTOK_VIDEO_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  const context: CanvasRenderingContext2D = ctx;

  const images = await Promise.all(listing.photos.slice(0, 8).map((photo) => loadImage(photo.url, signal)));
  if (!images.length) throw new Error("This listing has no photos to turn into a video");

  drawVideoFrame(context, listing, images, 0.02);
  onPreview(canvas.toDataURL("image/jpeg", 0.84));

  const stream = canvas.captureStream(FPS);
  const mimeType = getRecorderMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 4_500_000 } : undefined);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Video recording failed"));
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const type = recorder.mimeType || mimeType || "video/webm";
      resolve(new Blob(chunks, { type }));
    };
  });

  const cancel = () => {
    if (recorder.state !== "inactive") recorder.stop();
  };
  signal.addEventListener("abort", cancel, { once: true });
  recorder.start();
  const startedAt = performance.now();

  try {
    await new Promise<void>((resolve) => {
      function tick(now: number) {
        if (signal.aborted) {
          resolve();
          return;
        }
        const elapsed = now - startedAt;
        const progress = Math.min(1, elapsed / TIKTOK_VIDEO_LENGTH_MS);
        drawVideoFrame(context, listing, images, progress);
        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          if (recorder.state !== "inactive") recorder.stop();
          resolve();
        }
      }
      requestAnimationFrame(tick);
    });

    const blob = await finished;
    if (signal.aborted) throw new DOMException("Video rendering was cancelled", "AbortError");

    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const safeName = caption
      .split(/\s+/)
      .slice(0, 4)
      .join("-")
      .replace(/[^a-z0-9-]/gi, "")
      .toLowerCase();
    return {
      blob,
      filename: `tiktok-${listing.backupId}-${safeName || "listing"}.${ext}`,
      url: URL.createObjectURL(blob),
    };
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}
