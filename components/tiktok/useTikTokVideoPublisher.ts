"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  buildDefaultTikTokCaption,
  renderTikTokVideo,
  type RenderedTikTokVideo,
  type TikTokVideoListingPayload,
} from "@/components/tiktok/video-renderer";
import { errorMessage, isAbortError, parseJson } from "@/lib/utils";
import { getLocalStorageItem, setLocalStorageItem } from "@/components/publisher/local-storage";

export type TikTokPhoto = TikTokVideoListingPayload["photos"][number] & {
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

  const parsed = parseJson<{ order?: unknown; unusable?: unknown }>(rawState, {});
  if (Array.isArray(parsed.order)) {
    savedOrder = parsed.order.filter((id): id is number => Number.isFinite(id));
  }
  if (Array.isArray(parsed.unusable)) {
    savedUnusable = new Set(parsed.unusable.filter((id): id is number => Number.isFinite(id)));
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

export function useTikTokVideoPublisher() {
  const [listing, setListing] = useState<TikTokVideoListingPayload | null>(null);
  const [photos, setPhotos] = useState<TikTokPhoto[]>([]);
  const [caption, setCaption] = useState("");
  const [rendering, setRendering] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [video, setVideo] = useState<RenderedTikTokVideo | null>(null);
  const [draggedPhotoId, setDraggedPhotoId] = useState<number | null>(null);
  const [dragOverPhotoId, setDragOverPhotoId] = useState<number | null>(null);
  const autoRenderedRef = useRef(false);
  const renderControllerRef = useRef<AbortController | null>(null);
  const videoUrlRef = useRef<string | null>(null);

  const replaceVideo = useCallback((nextVideo: RenderedTikTokVideo | null) => {
    setVideo((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      videoUrlRef.current = nextVideo?.url ?? null;
      return nextVideo;
    });
  }, []);

  const loadListingState = useCallback((data: TikTokVideoListingPayload) => {
    setListing(data);
    autoRenderedRef.current = false;
    setPhotos(
      applySavedPhotoState(
        data.photos,
        getLocalStorageItem(`${PHOTO_STATE_STORAGE_PREFIX}${data.backupId}`),
      ),
    );
    const savedCaption = getLocalStorageItem(`${CAPTION_STORAGE_PREFIX}${data.backupId}`);
    setCaption(savedCaption || buildDefaultTikTokCaption(data));
    replaceVideo(null);
    setPreviewUrl("");
  }, [replaceVideo]);

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
    setLocalStorageItem(`${PHOTO_STATE_STORAGE_PREFIX}${listing.backupId}`, serializePhotoState(nextPhotos));
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
    setLocalStorageItem(`${CAPTION_STORAGE_PREFIX}${listing.backupId}`, caption);
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
      if (isAbortError(error)) return;
      toast.error(errorMessage(error, "Could not create video"));
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

  return {
    photos,
    caption,
    setCaption,
    rendering,
    previewUrl,
    video,
    draggedPhotoId,
    dragOverPhotoId,
    setDragOverPhotoId,
    usablePhotos,
    canRender,
    loadListingState,
    togglePhotoUsable,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    generateVideo,
  };
}
