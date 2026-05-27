"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { errorMessage, parseApiResponse } from "@/lib/utils";

export function usePublisherListing<T>(
  url: string,
  fallbackError: string,
  onLoad?: (data: T) => void,
) {
  const [listing, setListing] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => parseApiResponse<T>(res, fallbackError))
      .then((data) => {
        if (cancelled) return;
        setListing(data);
        onLoad?.(data);
      })
      .catch((error) => toast.error(errorMessage(error, fallbackError)))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fallbackError, onLoad, url]);

  return { listing, loading, setListing };
}
