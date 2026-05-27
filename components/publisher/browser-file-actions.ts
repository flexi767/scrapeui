"use client";

export function downloadBrowserUrl(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

export async function shareFilesOrThrow(data: {
  title?: string;
  text?: string;
  files: File[];
}): Promise<void> {
  const nav = navigator as Navigator & {
    canShare?: (payload: { files?: File[] }) => boolean;
    share?: (payload: { title?: string; text?: string; files?: File[] }) => Promise<void>;
  };
  if (!nav.share || (nav.canShare && !nav.canShare({ files: data.files }))) {
    throw new Error("This browser cannot share these files directly.");
  }

  await nav.share(data);
}

