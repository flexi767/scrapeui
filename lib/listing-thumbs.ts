import fsp from 'fs/promises';
import path from 'path';

const THUMB_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png', '.gif'];

export function getListingThumbDir(): string {
  return path.join(process.cwd(), 'public', 't');
}

export async function findSavedListingThumbPath(mobileId: string): Promise<string | null> {
  const dir = getListingThumbDir();

  for (const extension of THUMB_EXTENSIONS) {
    const filePath = path.join(dir, `${mobileId}${extension}`);
    try {
      const stat = await fsp.stat(filePath);
      if (stat.isFile() && stat.size > 0) return filePath;
    } catch {
      // ignore missing files
    }
  }

  return null;
}

function extensionFromContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  const lower = contentType.toLowerCase();
  if (lower.includes('image/webp')) return '.webp';
  if (lower.includes('image/jpeg')) return '.jpg';
  if (lower.includes('image/png')) return '.png';
  if (lower.includes('image/gif')) return '.gif';
  return null;
}

function extensionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return THUMB_EXTENSIONS.find((extension) => pathname.endsWith(extension)) ?? null;
  } catch {
    return null;
  }
}

export async function saveListingThumb(mobileId: string, sourceUrl: string | null | undefined): Promise<string | null> {
  if (!mobileId || !sourceUrl) return null;

  const response = await fetch(sourceUrl, { redirect: 'follow' });
  if (!response.ok) return null;

  const extension = extensionFromContentType(response.headers.get('content-type')) || extensionFromUrl(sourceUrl) || '.webp';
  const dir = getListingThumbDir();
  await fsp.mkdir(dir, { recursive: true });

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) return null;

  const targetPath = path.join(dir, `${mobileId}${extension}`);
  await fsp.writeFile(targetPath, bytes);

  await Promise.all(
    THUMB_EXTENSIONS
      .filter((value) => value !== extension)
      .map(async (value) => {
        try {
          await fsp.unlink(path.join(dir, `${mobileId}${value}`));
        } catch {
          // ignore missing files
        }
      }),
  );

  return targetPath;
}

export function getContentTypeForThumbPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}
