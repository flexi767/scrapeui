export function loadImage(src: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Image load cancelled', 'AbortError'));
      return;
    }

    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load image'));
    image.src = src;

    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          image.src = '';
          reject(new DOMException('Image load cancelled', 'AbortError'));
        },
        { once: true },
      );
    }
  });
}

export function drawWrappedText(
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
  let line = '';
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

export function drawCoverImage(
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
