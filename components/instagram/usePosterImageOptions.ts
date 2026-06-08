"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getLocalStorageItem,
  setLocalStorageItem,
} from "@/components/publisher/local-storage";
import { apiRequest, errorMessage } from "@/lib/utils";

export type PosterImageProviderId = "openai" | "comfyui";

export interface PosterImageModelOption {
  id: string;
  label: string;
}

export interface PosterImageProviderOption {
  id: PosterImageProviderId;
  label: string;
  defaultModel: string;
  models: PosterImageModelOption[];
}

interface PosterImageOptionsResponse {
  defaultProvider: PosterImageProviderId;
  providers: PosterImageProviderOption[];
}

const IMAGE_PROVIDER_STORAGE_KEY = "scrapeui:instagram-poster-image-provider";
const IMAGE_MODEL_STORAGE_PREFIX = "scrapeui:instagram-poster-image-model:";

const FALLBACK_IMAGE_PROVIDER_OPTIONS: PosterImageProviderOption[] = [
  { id: "openai", label: "OpenAI", defaultModel: "gpt-image-2", models: [{ id: "gpt-image-2", label: "gpt-image-2" }] },
  { id: "comfyui", label: "ComfyUI", defaultModel: "default", models: [{ id: "default", label: "Default workflow" }] },
];

export function usePosterImageOptions() {
  const [imageProvider, setImageProviderState] = useState<PosterImageProviderId>("openai");
  const [imageModelByProvider, setImageModelByProvider] = useState<Record<string, string>>({});
  const [imageProviderOptions, setImageProviderOptions] = useState<PosterImageProviderOption[]>(FALLBACK_IMAGE_PROVIDER_OPTIONS);

  useEffect(() => {
    let cancelled = false;
    async function loadImageOptions() {
      try {
        const options = await apiRequest<PosterImageOptionsResponse>(
          "/api/instagram/poster-image-options",
          "Could not load image provider options",
        );
        if (cancelled) return;
        setImageProviderOptions(options.providers);
        const savedProvider = getLocalStorageItem(IMAGE_PROVIDER_STORAGE_KEY) as PosterImageProviderId | null;
        const nextProvider: PosterImageProviderId =
          savedProvider && options.providers.some((provider) => provider.id === savedProvider)
            ? savedProvider
            : options.defaultProvider;
        setImageProviderState(nextProvider);
        setImageModelByProvider(
          Object.fromEntries(
            options.providers.map((provider) => {
              const savedModel = getLocalStorageItem(`${IMAGE_MODEL_STORAGE_PREFIX}${provider.id}`);
              const model =
                savedModel && provider.models.some((item) => item.id === savedModel)
                  ? savedModel
                  : provider.defaultModel;
              return [provider.id, model];
            }),
          ),
        );
      } catch (error) {
        toast.error(errorMessage(error, "Could not load image provider options"));
      }
    }
    void loadImageOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProviderOption = useMemo(
    () => imageProviderOptions.find((provider) => provider.id === imageProvider) ?? imageProviderOptions[0],
    [imageProvider, imageProviderOptions],
  );
  const imageModel = imageModelByProvider[imageProvider] ?? selectedProviderOption?.defaultModel ?? "";
  const selectedProviderModels = selectedProviderOption?.models ?? [];

  const setImageProvider = useCallback((provider: PosterImageProviderId) => {
    setImageProviderState(provider);
    setLocalStorageItem(IMAGE_PROVIDER_STORAGE_KEY, provider);
  }, []);

  const setImageModel = useCallback((model: string) => {
    setImageModelByProvider((current) => ({ ...current, [imageProvider]: model }));
    setLocalStorageItem(`${IMAGE_MODEL_STORAGE_PREFIX}${imageProvider}`, model);
  }, [imageProvider]);

  return {
    imageProvider,
    setImageProvider,
    imageModel,
    setImageModel,
    imageProviderOptions,
    selectedProviderModels,
  };
}
