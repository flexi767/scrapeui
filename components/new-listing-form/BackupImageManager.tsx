"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { errorMessage, parseApiResponse } from "@/lib/utils";
import { IMAGE_UPLOAD_BATCH_SIZE, type BackupImage } from "./constants";

interface BackupImagesResponse {
  images?: BackupImage[];
}

export function BackupImageManager({ backupId }: { backupId: number }) {
  const t = useTranslations('ui');
  const [images, setImages] = useState<BackupImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [draggedImageId, setDraggedImageId] = useState<number | null>(null);
  const [dragOverImageId, setDragOverImageId] = useState<number | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
    null,
  );
  const [error, setError] = useState("");

  const loadImages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/editown/backups/${backupId}/images`);
      const data = await parseApiResponse<BackupImagesResponse>(response, "Грешка при зареждане на снимките.");
      setImages(data.images ?? []);
    } catch (loadError) {
      setError(errorMessage(loadError, "Грешка при зареждане на снимките."));
    } finally {
      setLoading(false);
    }
  }, [backupId]);

  useEffect(() => {
    void loadImages();
  }, [loadImages]);

  async function uploadImages(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    setError("");
    try {
      for (let index = 0; index < files.length; index += IMAGE_UPLOAD_BATCH_SIZE) {
        const formData = new FormData();
        for (const file of files.slice(index, index + IMAGE_UPLOAD_BATCH_SIZE)) {
          formData.append("images", file);
        }

        const response = await fetch(`/api/editown/backups/${backupId}/images`, {
          method: "POST",
          body: formData,
        });
        const data = await parseApiResponse<BackupImagesResponse>(response, "Грешка при качване на снимките.");
        setImages(data.images ?? []);
      }
    } catch (uploadError) {
      setError(errorMessage(uploadError, "Грешка при качване на снимките."));
    } finally {
      setUploading(false);
    }
  }

  async function saveOrder(nextImages: BackupImage[]) {
    const previous = images;
    setImages(nextImages);
    setSavingOrder(true);
    setError("");
    try {
      const response = await fetch(`/api/editown/backups/${backupId}/images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: nextImages.map((image) => image.id) }),
      });
      const data = await parseApiResponse<BackupImagesResponse>(response, "Грешка при пренареждане на снимките.");
      setImages(data.images ?? nextImages);
    } catch (orderError) {
      setImages(previous);
      setError(errorMessage(orderError, "Грешка при пренареждане на снимките."));
    } finally {
      setSavingOrder(false);
    }
  }

  function reorderImages(sourceId: number, targetId: number) {
    if (sourceId === targetId || savingOrder) return;

    const sourceIndex = images.findIndex((image) => image.id === sourceId);
    const targetIndex = images.findIndex((image) => image.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const next = [...images];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    void saveOrder(next);
  }

  function handleDragStart(
    event: React.DragEvent<HTMLDivElement>,
    imageId: number,
  ) {
    setDraggedImageId(imageId);
    setConfirmingDeleteId(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(imageId));
  }

  function handleDragOver(
    event: React.DragEvent<HTMLDivElement>,
    imageId: number,
  ) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverImageId(imageId);
  }

  function handleDrop(
    event: React.DragEvent<HTMLDivElement>,
    targetImageId: number,
  ) {
    event.preventDefault();
    const sourceImageId =
      Number(event.dataTransfer.getData("text/plain")) || draggedImageId;
    setDraggedImageId(null);
    setDragOverImageId(null);
    if (sourceImageId) {
      reorderImages(sourceImageId, targetImageId);
    }
  }

  function handleDragEnd() {
    setDraggedImageId(null);
    setDragOverImageId(null);
  }

  async function deleteImage(imageId: number) {
    setDeletingId(imageId);
    setError("");
    try {
      const response = await fetch(
        `/api/editown/backups/${backupId}/images/${imageId}`,
        { method: "DELETE" },
      );
      await parseApiResponse<unknown>(response, "Грешка при изтриване на снимката.");
      setImages((current) => current.filter((image) => image.id !== imageId));
      setConfirmingDeleteId(null);
    } catch (deleteError) {
      setError(errorMessage(deleteError, "Грешка при изтриване на снимката."));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{t('images')}</h2>
          <p className="mt-1 text-sm text-gray-400">
            {t('images_description')}
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-gray-950 transition hover:bg-sky-400">
          {uploading ? t('uploading') : t('upload_images')}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={uploadImages}
          />
        </label>
      </div>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {savingOrder ? (
        <p className="mt-4 text-sm text-sky-300">{t('saving_order')}</p>
      ) : null}

      {loading ? (
        <div className="mt-5 rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-sm text-gray-400">
          {t('loading_images')}
        </div>
      ) : images.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-gray-700 bg-gray-900/40 p-8 text-center text-sm text-gray-400">
          {t('no_images_yet')}
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              draggable={!savingOrder && deletingId !== image.id}
              onDragStart={(event) => handleDragStart(event, image.id)}
              onDragOver={(event) => handleDragOver(event, image.id)}
              onDragLeave={() => setDragOverImageId(null)}
              onDrop={(event) => handleDrop(event, image.id)}
              onDragEnd={handleDragEnd}
              className={`overflow-hidden rounded-xl border bg-gray-900/70 transition ${
                dragOverImageId === image.id && draggedImageId !== image.id
                  ? "border-sky-400 ring-2 ring-sky-500/40"
                  : "border-gray-800"
              } ${
                draggedImageId === image.id
                  ? "cursor-grabbing opacity-60 active:cursor-grabbing"
                  : "cursor-grab active:cursor-grabbing"
              }`}
            >
              <ImageWithFallback
                src={image.url}
                alt={image.filename}
                className="aspect-[4/3] w-full object-cover"
                fallbackClassName="flex aspect-[4/3] w-full items-center justify-center bg-gray-800 text-gray-400"
                fallbackLabel="Missing"
              />
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 truncate text-xs text-gray-400">
                    {index + 1}. {image.filename}
                  </div>
                  {confirmingDeleteId === image.id ? (
                    <div className="ml-auto flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void deleteImage(image.id)}
                        disabled={deletingId === image.id}
                        className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === image.id ? "..." : t('yes')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        disabled={deletingId === image.id}
                        className="rounded-full px-2 py-0.5 text-[11px] text-gray-400 transition hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('no')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(image.id)}
                      disabled={deletingId === image.id}
                      title={t('delete_image')}
                      aria-label={t('delete_image')}
                      className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-base leading-none text-red-400 transition hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
