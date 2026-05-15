"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  PlayIcon,
  RefreshCwIcon,
  SendIcon,
} from "lucide-react";
import { toast } from "sonner";
import { TikTokIcon } from "@/components/tiktok/TikTokIcon";
import {
  buildDefaultTikTokCaption,
  formatTikTokMileage,
  formatTikTokPrice,
  renderTikTokVideo,
  type RenderedTikTokVideo,
  type TikTokVideoListingPayload,
} from "@/components/tiktok/video-renderer";

interface Props {
  backupId: number;
}

type TikTokPhoto = TikTokVideoListingPayload["photos"][number] & {
  usable: boolean;
};

const CAPTION_STORAGE_PREFIX = "scrapeui:tiktok-caption:";
const PHOTO_STATE_STORAGE_PREFIX = "scrapeui:tiktok-photo-state:";

function applySavedPhotoState(
  photos: TikTokVideoListingPayload["photos"],
  rawState: string | null,
): TikTokPhoto[] {
  let savedOrder: number[] = [];
  let savedUnusable = new Set<number>();

  if (rawState) {
    try {
      const parsed = JSON.parse(rawState) as { order?: unknown; unusable?: unknown };
      if (Array.isArray(parsed.order)) {
        savedOrder = parsed.order.filter((id): id is number => Number.isFinite(id));
      }
      if (Array.isArray(parsed.unusable)) {
        savedUnusable = new Set(parsed.unusable.filter((id): id is number => Number.isFinite(id)));
      }
    } catch {
      savedOrder = [];
      savedUnusable = new Set<number>();
    }
  }

  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const ordered = [
    ...savedOrder.map((id) => byId.get(id)).filter((photo): photo is TikTokVideoListingPayload["photos"][number] => Boolean(photo)),
    ...photos.filter((photo) => !savedOrder.includes(photo.id)),
  ];

  return ordered.map((photo) => ({
    ...photo,
    usable: !savedUnusable.has(photo.id),
  }));
}

function serializePhotoState(photos: TikTokPhoto[]) {
  return JSON.stringify({
    order: photos.map((photo) => photo.id),
    unusable: photos.filter((photo) => !photo.usable).map((photo) => photo.id),
  });
}

export function TikTokPublisherClient({ backupId }: Props) {
  const [listing, setListing] = useState<TikTokVideoListingPayload | null>(null);
  const [photos, setPhotos] = useState<TikTokPhoto[]>([]);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [video, setVideo] = useState<RenderedTikTokVideo | null>(null);
  const [draggedPhotoId, setDraggedPhotoId] = useState<number | null>(null);
  const [dragOverPhotoId, setDragOverPhotoId] = useState<number | null>(null);
  const autoRenderedRef = useRef(false);
  const renderControllerRef = useRef<AbortController | null>(null);
  const videoUrlRef = useRef<string | null>(null);

  const usablePhotos = useMemo(() => photos.filter((photo) => photo.usable), [photos]);
  const videoListing = useMemo<TikTokVideoListingPayload | null>(() => {
    if (!listing) return null;
    return {
      ...listing,
      photos: usablePhotos,
    };
  }, [listing, usablePhotos]);

  const canRender = useMemo(
    () => Boolean(videoListing && videoListing.photos.length > 0 && !rendering),
    [rendering, videoListing],
  );

  const replaceVideo = useCallback((nextVideo: RenderedTikTokVideo | null) => {
    setVideo((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      videoUrlRef.current = nextVideo?.url ?? null;
      return nextVideo;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/tiktok/listings/${backupId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load listing");
        return data as TikTokVideoListingPayload;
      })
      .then((data) => {
        if (cancelled) return;
        setListing(data);
        autoRenderedRef.current = false;
        setPhotos(
          applySavedPhotoState(
            data.photos,
            window.localStorage.getItem(`${PHOTO_STATE_STORAGE_PREFIX}${data.backupId}`),
          ),
        );
        const savedCaption = window.localStorage.getItem(`${CAPTION_STORAGE_PREFIX}${data.backupId}`);
        setCaption(savedCaption || buildDefaultTikTokCaption(data));
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load listing"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [backupId]);

  useEffect(() => {
    return () => {
      renderControllerRef.current?.abort();
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    };
  }, []);

  function updatePhotos(nextPhotos: TikTokPhoto[]) {
    if (!listing) return;
    setPhotos(nextPhotos);
    window.localStorage.setItem(`${PHOTO_STATE_STORAGE_PREFIX}${listing.backupId}`, serializePhotoState(nextPhotos));
    renderControllerRef.current?.abort();
    replaceVideo(null);
    setPreviewUrl("");
    autoRenderedRef.current = true;
  }

  function reorderPhotos(sourceId: number, targetId: number) {
    if (sourceId === targetId || rendering) return;
    const sourceIndex = photos.findIndex((photo) => photo.id === sourceId);
    const targetIndex = photos.findIndex((photo) => photo.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const next = [...photos];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    updatePhotos(next);
  }

  function togglePhotoUsable(photoId: number) {
    updatePhotos(
      photos.map((photo) =>
        photo.id === photoId
          ? {
              ...photo,
              usable: !photo.usable,
            }
          : photo,
      ),
    );
  }

  function handleDragStart(event: React.DragEvent<HTMLDivElement>, photoId: number) {
    setDraggedPhotoId(photoId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(photoId));
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>, photoId: number) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverPhotoId(photoId);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>, targetPhotoId: number) {
    event.preventDefault();
    const sourcePhotoId = Number(event.dataTransfer.getData("text/plain")) || draggedPhotoId;
    setDraggedPhotoId(null);
    setDragOverPhotoId(null);
    if (sourcePhotoId) reorderPhotos(sourcePhotoId, targetPhotoId);
  }

  function handleDragEnd() {
    setDraggedPhotoId(null);
    setDragOverPhotoId(null);
  }

  const generateVideo = useCallback(async () => {
    if (!listing || !videoListing || rendering) return;
    if (videoListing.photos.length === 0) {
      toast.error("Mark at least one image as usable before generating the video.");
      return;
    }
    window.localStorage.setItem(`${CAPTION_STORAGE_PREFIX}${listing.backupId}`, caption);
    renderControllerRef.current?.abort();
    const controller = new AbortController();
    renderControllerRef.current = controller;
    setRendering(true);
    setPreviewUrl("");

    try {
      const nextVideo = await renderTikTokVideo({
        listing: videoListing,
        caption,
        signal: controller.signal,
        onPreview: setPreviewUrl,
      });
      if (controller.signal.aborted) {
        URL.revokeObjectURL(nextVideo.url);
        return;
      }
      replaceVideo(nextVideo);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Could not create video");
    } finally {
      if (renderControllerRef.current === controller) {
        renderControllerRef.current = null;
        setRendering(false);
      }
    }
  }, [caption, listing, rendering, replaceVideo, videoListing]);

  useEffect(() => {
    if (!videoListing || !caption || autoRenderedRef.current) return;
    autoRenderedRef.current = true;
    void generateVideo();
  }, [caption, generateVideo, videoListing]);

  async function copyCaption() {
    await navigator.clipboard.writeText(caption);
  }

  function downloadVideo() {
    if (!video) return;
    const link = document.createElement("a");
    link.href = video.url;
    link.download = video.filename;
    link.click();
  }

  async function shareToTikTok() {
    if (!video || !listing) return;
    setSharing(true);
    try {
      const file = new File([video.blob], video.filename, { type: video.blob.type || "video/webm" });
      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
      };
      if (!nav.share || (nav.canShare && !nav.canShare({ files: [file] }))) {
        await navigator.clipboard.writeText(caption).catch(() => undefined);
        window.open("https://www.tiktok.com/upload", "_blank", "noopener,noreferrer");
        toast.message("TikTok upload opened. Download the video here, then upload it there.");
        return;
      }
      await nav.share({
        title: listing.title,
        text: caption,
        files: [file],
      });
      toast.success("Share sheet opened");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open share sheet");
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-gray-300">Loading TikTok publisher...</div>;
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
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-white">
            <TikTokIcon className="h-6 w-6 text-cyan-200" />
            TikTok publish
          </h1>
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
            onClick={() => void generateVideo()}
            disabled={!canRender}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-700 px-3 text-sm text-gray-100 hover:bg-gray-800 disabled:opacity-50"
          >
            <RefreshCwIcon className={`h-4 w-4 ${rendering ? "animate-spin" : ""}`} />
            {rendering ? "Rendering..." : "Regenerate"}
          </button>
          <button
            type="button"
            onClick={downloadVideo}
            disabled={!video}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-700 px-3 text-sm text-gray-100 hover:bg-gray-800 disabled:opacity-50"
          >
            <DownloadIcon className="h-4 w-4" />
            Video
          </button>
          <button
            type="button"
            onClick={() => void shareToTikTok()}
            disabled={!video || sharing}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-500 px-3 text-sm font-medium text-gray-950 hover:bg-cyan-400 disabled:opacity-50"
          >
            <SendIcon className="h-4 w-4" />
            {sharing ? "Opening..." : "Post to TikTok"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[360px]">
            <div className="overflow-hidden rounded-lg border border-gray-800 bg-black">
              {video ? (
                <video src={video.url} controls playsInline className="aspect-[9/16] w-full bg-black object-cover" />
              ) : previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Video preview" className="aspect-[9/16] w-full bg-black object-cover" />
              ) : (
                <div className="flex aspect-[9/16] w-full items-center justify-center bg-gray-950 text-gray-500">
                  <PlayIcon className="h-10 w-10" />
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Source photos</h2>
            <div className="grid grid-cols-2 gap-3 2xl:grid-cols-3">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  data-photo-id={photo.id}
                  draggable={!rendering}
                  onDragStart={(event) => handleDragStart(event, photo.id)}
                  onDragOver={(event) => handleDragOver(event, photo.id)}
                  onDragLeave={() => setDragOverPhotoId(null)}
                  onDrop={(event) => handleDrop(event, photo.id)}
                  onDragEnd={handleDragEnd}
                  className={`group overflow-hidden rounded-lg border bg-gray-900 transition ${
                    dragOverPhotoId === photo.id && draggedPhotoId !== photo.id
                      ? "border-cyan-300 ring-2 ring-cyan-400/30"
                      : photo.usable
                        ? "border-gray-800 hover:border-gray-600"
                        : "border-red-500/40 opacity-55"
                  } ${draggedPhotoId === photo.id ? "cursor-grabbing opacity-60" : "cursor-grab"}`}
                >
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={`Source photo ${index + 1}`}
                      className={`aspect-[9/12] w-full object-cover ${photo.usable ? "" : "grayscale"}`}
                    />
                    <div className="absolute left-1 top-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-gray-950/75 px-1.5 text-xs tabular-nums text-white">
                      {index + 1}
                    </div>
                    <GripVerticalIcon className="absolute right-1 top-1 h-5 w-5 rounded-full bg-gray-950/70 p-0.5 text-gray-300" />
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePhotoUsable(photo.id)}
                    disabled={rendering}
                    className={`flex h-8 w-full items-center justify-center gap-1.5 px-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      photo.usable
                        ? "text-gray-300 hover:bg-gray-800 hover:text-white"
                        : "bg-red-950/40 text-red-200 hover:bg-red-900/50"
                    }`}
                  >
                    {photo.usable ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeOffIcon className="h-3.5 w-3.5" />}
                    {photo.usable ? "Use" : "Skip"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <TikTokIcon className="h-4 w-4 text-cyan-200" />
              Video data
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-gray-800 px-3 py-2">
                <div className="text-xs text-gray-500">Length</div>
                <div className="text-gray-100">15s</div>
              </div>
              <div className="rounded-md bg-gray-800 px-3 py-2">
                <div className="text-xs text-gray-500">Format</div>
                <div className="text-gray-100">9:16</div>
              </div>
              <div className="rounded-md bg-gray-800 px-3 py-2">
                <div className="text-xs text-gray-500">Photos</div>
                <div data-testid="tiktok-usable-photo-count" className="text-gray-100">
                  {usablePhotos.length}/{photos.length}
                </div>
              </div>
              <div className="rounded-md bg-gray-800 px-3 py-2">
                <div className="text-xs text-gray-500">Price</div>
                <div className="text-gray-100">{formatTikTokPrice(listing.price)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Caption</h2>
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={12}
              className="w-full resize-y rounded-md border border-gray-700 bg-gray-950 p-3 text-sm leading-6 text-gray-200"
            />
            <div className="mt-2 text-xs text-gray-500">
              {formatTikTokMileage(listing.mileage)} · {formatTikTokPrice(listing.price)}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
