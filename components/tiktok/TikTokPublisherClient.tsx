"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CopyIcon, DownloadIcon, PlayIcon, RefreshCwIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";
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

const CAPTION_STORAGE_PREFIX = "scrapeui:tiktok-caption:";

export function TikTokPublisherClient({ backupId }: Props) {
  const [listing, setListing] = useState<TikTokVideoListingPayload | null>(null);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [video, setVideo] = useState<RenderedTikTokVideo | null>(null);
  const autoRenderedRef = useRef(false);
  const renderControllerRef = useRef<AbortController | null>(null);
  const videoUrlRef = useRef<string | null>(null);

  const canRender = useMemo(
    () => Boolean(listing && listing.photos.length > 0 && !rendering),
    [listing, rendering],
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
        const savedCaption = window.localStorage.getItem(`${CAPTION_STORAGE_PREFIX}${data.backupId}`);
        setCaption(savedCaption || buildDefaultTikTokCaption(data));
      })
      .catch((error) => toast.error(errorMessage(error)))
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

  const generateVideo = useCallback(async () => {
    if (!listing || rendering) return;
    window.localStorage.setItem(`${CAPTION_STORAGE_PREFIX}${listing.backupId}`, caption);
    renderControllerRef.current?.abort();
    const controller = new AbortController();
    renderControllerRef.current = controller;
    setRendering(true);
    setPreviewUrl("");

    try {
      const nextVideo = await renderTikTokVideo({
        listing,
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
      toast.error(errorMessage(error));
    } finally {
      if (renderControllerRef.current === controller) {
        renderControllerRef.current = null;
        setRendering(false);
      }
    }
  }, [caption, listing, rendering, replaceVideo]);

  useEffect(() => {
    if (!listing || !caption || autoRenderedRef.current) return;
    autoRenderedRef.current = true;
    void generateVideo();
  }, [caption, generateVideo, listing]);

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
      toast.error(errorMessage(error));
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
            <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
              {listing.photos.slice(0, 8).map((photo, index) => (
                <a
                  key={photo.id}
                  href={photo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900 hover:border-gray-600"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={`Source photo ${index + 1}`} className="aspect-[9/12] w-full object-cover" />
                  <div className="px-2 py-1 text-center text-xs tabular-nums text-gray-300">{index + 1}</div>
                </a>
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
                <div className="text-gray-100">{listing.photos.length}</div>
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
