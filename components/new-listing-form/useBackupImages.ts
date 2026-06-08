"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest, errorMessage } from "@/lib/utils";
import { IMAGE_UPLOAD_BATCH_SIZE, type BackupImage } from "./constants";

interface BackupImagesResponse {
  images?: BackupImage[];
}

export function useBackupImages(backupId: number) {
  const [images, setImages] = useState<BackupImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadImages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<BackupImagesResponse>(
        `/api/editown/backups/${backupId}/images`,
        "Грешка при зареждане на снимките.",
      );
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

  async function uploadImages(files: File[]) {
    if (files.length === 0) return;

    setUploading(true);
    setError("");
    try {
      for (let index = 0; index < files.length; index += IMAGE_UPLOAD_BATCH_SIZE) {
        const formData = new FormData();
        for (const file of files.slice(index, index + IMAGE_UPLOAD_BATCH_SIZE)) {
          formData.append("images", file);
        }

        const data = await apiRequest<BackupImagesResponse>(
          `/api/editown/backups/${backupId}/images`,
          "Грешка при качване на снимките.",
          { method: "POST", body: formData },
        );
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
      const data = await apiRequest<BackupImagesResponse>(
        `/api/editown/backups/${backupId}/images`,
        "Грешка при пренареждане на снимките.",
        {
          method: "PATCH",
          json: { imageIds: nextImages.map((image) => image.id) },
        },
      );
      setImages(data.images ?? nextImages);
    } catch (orderError) {
      setImages(previous);
      setError(errorMessage(orderError, "Грешка при пренареждане на снимките."));
    } finally {
      setSavingOrder(false);
    }
  }

  async function deleteImage(imageId: number) {
    setDeletingId(imageId);
    setError("");
    try {
      await apiRequest<unknown>(
        `/api/editown/backups/${backupId}/images/${imageId}`,
        "Грешка при изтриване на снимката.",
        { method: "DELETE" },
      );
      setImages((current) => current.filter((image) => image.id !== imageId));
    } catch (deleteError) {
      setError(errorMessage(deleteError, "Грешка при изтриване на снимката."));
    } finally {
      setDeletingId(null);
    }
  }

  return {
    images,
    loading,
    uploading,
    savingOrder,
    deletingId,
    error,
    uploadImages,
    saveOrder,
    deleteImage,
  };
}
