"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getLocalStorageItem,
  getLocalStorageJson,
  removeLocalStorageItem,
  setLocalStorageItem,
  setLocalStorageJson,
} from "@/components/publisher/local-storage";
import { apiRequest, errorMessage } from "@/lib/utils";
import {
  applyConsistentTextToVariants,
  buildDefaultCollageSelections,
  generateAiPosters,
  generateFallbackPosters,
  normalizeCollageSelections,
  normalizeVariantPrompts,
} from "./publisher-workflow";
import {
  buildDefaultPosterPrompt,
  COLLAGE_SELECTION_STORAGE_PREFIX,
  DEFAULT_POSTER_VARIANT_PROMPTS,
  GLOBAL_PROMPT_TEMPLATE_STORAGE_KEY,
  GLOBAL_VARIANT_PROMPTS_STORAGE_KEY,
  PROMPT_STORAGE_PREFIX,
  VARIANT_PROMPT_STORAGE_PREFIX,
  type CollageSelections,
  type InstagramListingPayload,
  type PosterVariant,
  type PosterVariantPrompt,
} from "./poster";
import {
  buildPromptTemplateFromListing,
  resolvePromptTemplate,
} from "./poster-prompt-template";
import { usePosterImageOptions } from "./usePosterImageOptions";
export type {
  PosterImageModelOption,
  PosterImageProviderId,
  PosterImageProviderOption,
} from "./usePosterImageOptions";

interface ServerPosterDefaults {
  promptTemplate: string;
  variantPrompts: PosterVariantPrompt[];
}

export function useInstagramPosterWorkflow(listing: InstagramListingPayload | null) {
  const [generating, setGenerating] = useState(false);
  const [generatingVariantIds, setGeneratingVariantIds] = useState<string[]>([]);
  const [variants, setVariants] = useState<PosterVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("hero");
  const [posterPrompt, setPosterPrompt] = useState("");
  const [variantPrompts, setVariantPrompts] = useState<PosterVariantPrompt[]>(DEFAULT_POSTER_VARIANT_PROMPTS);
  const {
    imageProvider,
    setImageProvider,
    imageModel,
    setImageModel,
    imageProviderOptions,
    selectedProviderModels,
  } = usePosterImageOptions();
  const [collageSelections, setCollageSelections] = useState<CollageSelections>({
    exteriorPhotoIds: [],
    interiorPhotoIds: [],
  });
  const canvasSeedRef = useRef(0);
  const initialPosterGeneratedRef = useRef(false);

  const loadServerPosterDefaults = useCallback(async (data: InstagramListingPayload) => {
    try {
      const serverDefaults = await apiRequest<ServerPosterDefaults | null>(
        "/api/instagram/poster-defaults",
        "Could not load saved poster defaults",
      );
      if (!serverDefaults) return;
      if (!getLocalStorageItem(`${PROMPT_STORAGE_PREFIX}${data.backupId}`)) {
        setPosterPrompt(resolvePromptTemplate(serverDefaults.promptTemplate, data));
      }
      if (!getLocalStorageItem(`${VARIANT_PROMPT_STORAGE_PREFIX}${data.backupId}`)) {
        setVariantPrompts(normalizeVariantPrompts(serverDefaults.variantPrompts));
      }
    } catch (error) {
      toast.error(errorMessage(error, "Could not load saved poster defaults"));
    }
  }, []);

  const handleListingLoad = useCallback((data: InstagramListingPayload) => {
    initialPosterGeneratedRef.current = false;
    const savedPrompt = getLocalStorageItem(`${PROMPT_STORAGE_PREFIX}${data.backupId}`);
    const savedGlobalPromptTemplate = getLocalStorageItem(GLOBAL_PROMPT_TEMPLATE_STORAGE_KEY);
    const savedVariantPrompts = getLocalStorageJson<PosterVariantPrompt[] | null>(
      `${VARIANT_PROMPT_STORAGE_PREFIX}${data.backupId}`,
      null,
    );
    const savedGlobalVariantPrompts = getLocalStorageJson<PosterVariantPrompt[] | null>(GLOBAL_VARIANT_PROMPTS_STORAGE_KEY, null);
    const savedCollageSelections = getLocalStorageJson<CollageSelections | null>(
      `${COLLAGE_SELECTION_STORAGE_PREFIX}${data.backupId}`,
      null,
    );
    setPosterPrompt(
      savedPrompt || (savedGlobalPromptTemplate ? resolvePromptTemplate(savedGlobalPromptTemplate, data) : buildDefaultPosterPrompt(data)),
    );
    setVariantPrompts(
      savedVariantPrompts
        ? normalizeVariantPrompts(savedVariantPrompts)
        : savedGlobalVariantPrompts
          ? normalizeVariantPrompts(savedGlobalVariantPrompts)
        : DEFAULT_POSTER_VARIANT_PROMPTS,
    );
    setCollageSelections(
      savedCollageSelections
        ? normalizeCollageSelections(savedCollageSelections, data.photos)
        : buildDefaultCollageSelections(data.photos),
    );
    void loadServerPosterDefaults(data);
  }, [loadServerPosterDefaults]);

  const coverVariants = useMemo(
    () => variants.filter((variant) => variant.role !== "collage"),
    [variants],
  );
  const selectedVariant = useMemo(
    () => coverVariants.find((variant) => variant.id === selectedVariantId) ?? coverVariants[0],
    [coverVariants, selectedVariantId],
  );
  const collageVariants = useMemo(
    () => variants.filter((variant) => variant.role === "collage"),
    [variants],
  );
  const generatedVariantOrder = useMemo(
    () => new Map(DEFAULT_POSTER_VARIANT_PROMPTS.map((variant, index) => [variant.id, index])),
    [],
  );
  const mergeGeneratedVariants = useCallback(
    (current: PosterVariant[], next: PosterVariant[]) =>
      [...current.filter((variant) => !next.some((item) => item.id === variant.id)), ...next].sort(
        (a, b) => (generatedVariantOrder.get(a.id) ?? 999) - (generatedVariantOrder.get(b.id) ?? 999),
      ),
    [generatedVariantOrder],
  );

  const generatePosters = useCallback(async (force = false, variantId?: string) => {
    if (!listing) return;
    const prompt = posterPrompt.trim() || buildDefaultPosterPrompt(listing);
    const prompts = normalizeVariantPrompts(variantPrompts);
    const targetVariant = variantId ? prompts.find((variant) => variant.id === variantId) : null;
    const selections = normalizeCollageSelections(collageSelections, listing.photos);
    const needsExterior = !variantId || targetVariant?.id === "ai-exterior-collage";
    const needsInterior = !variantId || targetVariant?.id === "ai-interior-collage";
    if (needsExterior && selections.exteriorPhotoIds.length === 0) {
      toast.warning("Select at least one exterior photo for the exterior collage.");
      return;
    }
    if (needsInterior && selections.interiorPhotoIds.length === 0) {
      toast.warning("Select at least one interior photo for the interior collage.");
      return;
    }
    if (!targetVariant && variantId) {
      toast.error("Unknown poster type.");
      return;
    }
    if (!variantId && (selections.exteriorPhotoIds.length === 0 || selections.interiorPhotoIds.length === 0)) {
      toast.warning("Select at least one exterior and one interior photo for the collage pages.");
      return;
    }
    setLocalStorageItem(`${PROMPT_STORAGE_PREFIX}${listing.backupId}`, prompt);
    setLocalStorageJson(`${VARIANT_PROMPT_STORAGE_PREFIX}${listing.backupId}`, prompts);
    setLocalStorageJson(`${COLLAGE_SELECTION_STORAGE_PREFIX}${listing.backupId}`, selections);
    const seed = canvasSeedRef.current + 1;
    canvasSeedRef.current = seed;
    const targetIds = variantId ? [variantId] : prompts.map((variant) => variant.id);
    setGenerating(true);
    setGeneratingVariantIds(targetIds);
    try {
      const { variants: aiVariants, cached } = await generateAiPosters(listing.backupId, prompt, prompts, selections, {
        force,
        variantId,
        imageProvider,
        imageModel,
      });
      if (canvasSeedRef.current !== seed) return;
      const textVariants = await applyConsistentTextToVariants(listing, aiVariants);
      if (canvasSeedRef.current !== seed) return;
      setVariants((current) => (variantId ? mergeGeneratedVariants(current, textVariants) : textVariants));
      const nextSelectedCover = textVariants.find((variant) => variant.role !== "collage")?.id;
      if (nextSelectedCover) setSelectedVariantId(nextSelectedCover);
      toast.success(cached ? "Loaded saved AI posters" : variantId ? "AI poster generated" : "AI posters generated");
    } catch (error) {
      const aiError = errorMessage(error, "Could not generate AI posters");
      if (variantId) {
        toast.error(aiError);
        return;
      }
      toast.warning(`${aiError}. Using quick local posters instead.`);
      try {
        const { variants: textFallbackVariants, failedCount } = await generateFallbackPosters(listing, prompt, seed);
        if (canvasSeedRef.current !== seed) return;
        setVariants(textFallbackVariants);
        setSelectedVariantId("hero");
        if (failedCount > 0) {
          toast.warning(
            failedCount === listing.photos.slice(0, 5).length
              ? "Generated text-only posters because photos could not be loaded."
              : `Generated posters, skipping ${failedCount} photo${failedCount === 1 ? "" : "s"} that could not be loaded.`,
          );
        }
      } catch (fallbackError) {
        toast.error(errorMessage(fallbackError, "Could not generate posters"));
      }
    } finally {
      if (canvasSeedRef.current === seed) {
        setGenerating(false);
        setGeneratingVariantIds([]);
      }
    }
  }, [collageSelections, imageModel, imageProvider, listing, mergeGeneratedVariants, posterPrompt, variantPrompts]);

  const loadCachedPosters = useCallback(async () => {
    if (!listing) return;
    const prompt = posterPrompt.trim() || buildDefaultPosterPrompt(listing);
    const prompts = normalizeVariantPrompts(variantPrompts);
    const selections = normalizeCollageSelections(collageSelections, listing.photos);
    if (selections.exteriorPhotoIds.length === 0 || selections.interiorPhotoIds.length === 0) return;
    try {
      const { variants: cachedVariants } = await generateAiPosters(listing.backupId, prompt, prompts, selections, {
        cacheOnly: true,
        imageProvider,
        imageModel,
      });
      if (cachedVariants.length > 0) {
        const textVariants = await applyConsistentTextToVariants(listing, cachedVariants);
        setVariants(textVariants);
        setSelectedVariantId(textVariants.find((variant) => variant.role !== "collage")?.id ?? "ai-hero");
      }
    } catch (error) {
      toast.error(errorMessage(error, "Could not load saved posters"));
    }
  }, [collageSelections, imageModel, imageProvider, listing, posterPrompt, variantPrompts]);

  useEffect(() => {
    if (!listing || !posterPrompt || initialPosterGeneratedRef.current) return;
    initialPosterGeneratedRef.current = true;
    void loadCachedPosters();
  }, [loadCachedPosters, listing, posterPrompt]);

  function resetPosterPrompt() {
    if (!listing) return;
    const nextPrompt = buildDefaultPosterPrompt(listing);
    const nextSelections = buildDefaultCollageSelections(listing.photos);
    setPosterPrompt(nextPrompt);
    setVariantPrompts(DEFAULT_POSTER_VARIANT_PROMPTS);
    setCollageSelections(nextSelections);
    removeLocalStorageItem(`${PROMPT_STORAGE_PREFIX}${listing.backupId}`);
    removeLocalStorageItem(`${VARIANT_PROMPT_STORAGE_PREFIX}${listing.backupId}`);
    removeLocalStorageItem(`${COLLAGE_SELECTION_STORAGE_PREFIX}${listing.backupId}`);
  }

  async function saveDefaultsForFuture() {
    if (!listing) return;
    const prompt = posterPrompt.trim() || buildDefaultPosterPrompt(listing);
    const prompts = normalizeVariantPrompts(variantPrompts);
    const promptTemplate = buildPromptTemplateFromListing(prompt, listing);
    setLocalStorageItem(`${PROMPT_STORAGE_PREFIX}${listing.backupId}`, prompt);
    setLocalStorageJson(`${VARIANT_PROMPT_STORAGE_PREFIX}${listing.backupId}`, prompts);
    setLocalStorageItem(GLOBAL_PROMPT_TEMPLATE_STORAGE_KEY, promptTemplate);
    setLocalStorageJson(GLOBAL_VARIANT_PROMPTS_STORAGE_KEY, prompts);
    try {
      await apiRequest<ServerPosterDefaults>("/api/instagram/poster-defaults", "Could not save poster defaults", {
        method: "PUT",
        json: { promptTemplate, variantPrompts: prompts },
      });
      toast.success("Saved as the default Instagram poster style");
    } catch (error) {
      toast.error(errorMessage(error, "Saved in this browser, but not on the server"));
    }
  }

  function toggleCollagePhoto(kind: keyof CollageSelections, photoId: number) {
    setCollageSelections((current) => {
      const selected = new Set(current[kind]);
      if (selected.has(photoId)) selected.delete(photoId);
      else selected.add(photoId);
      const next = { ...current, [kind]: Array.from(selected) };
      if (listing) {
        setLocalStorageJson(
          `${COLLAGE_SELECTION_STORAGE_PREFIX}${listing.backupId}`,
          normalizeCollageSelections(next, listing.photos),
        );
      }
      return next;
    });
  }

  function applyDefaultCollageSelections() {
    if (!listing) return;
    const next = buildDefaultCollageSelections(listing.photos);
    setCollageSelections(next);
    setLocalStorageJson(`${COLLAGE_SELECTION_STORAGE_PREFIX}${listing.backupId}`, next);
  }

  return {
    generating,
    generatingVariantIds,
    selectedVariantId,
    setSelectedVariantId,
    posterPrompt,
    setPosterPrompt,
    variantPrompts,
    setVariantPrompts,
    imageProvider,
    setImageProvider,
    imageModel,
    setImageModel,
    imageProviderOptions,
    selectedProviderModels,
    collageSelections,
    hasVariants: variants.length > 0,
    coverVariants,
    selectedVariant,
    collageVariants,
    handleListingLoad,
    generatePosters,
    resetPosterPrompt,
    saveDefaultsForFuture,
    toggleCollagePhoto,
    applyDefaultCollageSelections,
  };
}
