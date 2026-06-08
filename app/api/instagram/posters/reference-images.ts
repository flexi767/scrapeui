import { readFile } from "fs/promises";
import path from "path";
import { raw } from "@/db/client";

export interface ReferenceImageRow {
  id: number;
  filename: string | null;
  local_path: string | null;
}

export function getReferenceImages(photoIds: number[]) {
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

export function mimeFromFilename(filename: string | null, localPath: string) {
  const ext = path.extname(filename || localPath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "image/webp";
}

export function mimeFromOutputFilename(filename: string | undefined) {
  const ext = path.extname(filename ?? "").toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

export async function appendReferenceImages(formData: FormData, referenceImages: ReferenceImageRow[]) {
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
