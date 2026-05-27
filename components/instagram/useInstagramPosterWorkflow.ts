"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";
import {
  buildDefaultCollageSelections,
  generateAiPosters,
  loadPosterImages,
  normalizeCollageSelections,
  normalizeVariantPrompts,
} from "./publisher-workflow";
import {
  buildDefaultPosterPrompt,
  COLLAGE_SELECTION_STORAGE_PREFIX,
  DEFAULT_POSTER_VARIANT_PROMPTS,
  makePoster,
  PROMPT_STORAGE_PREFIX,
  VARIANT_PROMPT_STORAGE_PREFIX,
  type CollageSelections,
  type InstagramListingPayload,
  type PosterVariant,
  type PosterVariantPrompt,
} from "./poster";

export function useInstagramPosterWorkflow(listing: InstagramListingPayload | null) {
  const [generating, setGenerating] = useState(false);
  const [generatingVariantIds, setGeneratingVariantIds] = useState<string[]>([]);
  const [variants, setVariants] = useState<PosterVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("hero");
  const [posterPrompt, setPosterPrompt] = useState("");
  const [variantPrompts, setVariantPrompts] = useState<PosterVariantPrompt[]>(DEFAULT_POSTER_VARIANT_PROMPTS);
  const [collageSelections, setCollageSelections] = useState<CollageSelections>({
    exteriorPhotoIds: [],
    interiorPhotoIds: [],
  });
  const canvasSeedRef = useRef(0);
  const initialPosterGeneratedRef = useRef(false);

  const handleListingLoad = useCallback((data: InstagramListingPayload) => {
    initialPosterGeneratedRef.current = false;
    const savedPrompt = window.localStorage.getItem(`${PROMPT_STORAGE_PREFIX}${data.backupId}`);
    const savedVariantPrompts = window.localStorage.getItem(`${VARIANT_PROMPT_STORAGE_PREFIX}${data.backupId}`);
    const savedCollageSelections = window.localStorage.getItem(`${COLLAGE_SELECTION_STORAGE_PREFIX}${data.backupId}`);
    setPosterPrompt(savedPrompt || buildDefaultPosterPrompt(data));
    try {
      setVariantPrompts(
        savedVariantPrompts
          ? normalizeVariantPrompts(JSON.parse(savedVariantPrompts) as PosterVariantPrompt[])
          : DEFAULT_POSTER_VARIANT_PROMPTS,
      );
    } catch {
      setVariantPrompts(DEFAULT_POSTER_VARIANT_PROMPTS);
    }
    try {
      setCollageSelections(
        savedCollageSelections
          ? normalizeCollageSelections(JSON.parse(savedCollageSelections) as CollageSelections, data.photos)
          : buildDefaultCollageSelections(data.photos),
      );
    } catch {
      setCollageSelections(buildDefaultCollageSelections(data.photos));
    }
  }, []);

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
    window.localStorage.setItem(`${PROMPT_STORAGE_PREFIX}${listing.backupId}`, prompt);
    window.localStorage.setItem(`${VARIANT_PROMPT_STORAGE_PREFIX}${listing.backupId}`, JSON.stringify(prompts));
    window.localStorage.setItem(`${COLLAGE_SELECTION_STORAGE_PREFIX}${listing.backupId}`, JSON.stringify(selections));
    const seed = canvasSeedRef.current + 1;
    canvasSeedRef.current = seed;
    const targetIds = variantId ? [variantId] : prompts.map((variant) => variant.id);
    setGenerating(true);
    setGeneratingVariantIds(targetIds);
    try {
      const { variants: aiVariants, cached } = await generateAiPosters(listing.backupId, prompt, prompts, selections, {
        force,
        variantId,
      });
      if (canvasSeedRef.current !== seed) return;
      setVariants((current) => (variantId ? mergeGeneratedVariants(current, aiVariants) : aiVariants));
      const nextSelectedCover = aiVariants.find((variant) => variant.role !== "collage")?.id;
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
        const { images: loaded, failedCount } = await loadPosterImages(listing.photos);
        if (canvasSeedRef.current !== seed) return;
        const fallbackVariants: PosterVariant[] = [
          { id: "hero", name: "Hero poster", role: "cover", dataUrl: makePoster(listing, loaded, "hero", prompt, seed * 3 + 1) },
          { id: "grid", name: "Triple shot", role: "cover", dataUrl: makePoster(listing, loaded, "grid", prompt, seed * 3 + 2) },
          { id: "editorial", name: "Clean gallery", role: "cover", dataUrl: makePoster(listing, loaded, "editorial", prompt, seed * 3 + 3) },
        ];
        if (canvasSeedRef.current !== seed) return;
        setVariants(fallbackVariants);
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
  }, [collageSelections, listing, mergeGeneratedVariants, posterPrompt, variantPrompts]);

  const loadCachedPosters = useCallback(async () => {
    if (!listing) return;
    const prompt = posterPrompt.trim() || buildDefaultPosterPrompt(listing);
    const prompts = normalizeVariantPrompts(variantPrompts);
    const selections = normalizeCollageSelections(collageSelections, listing.photos);
    if (selections.exteriorPhotoIds.length === 0 || selections.interiorPhotoIds.length === 0) return;
    try {
      const { variants: cachedVariants } = await generateAiPosters(listing.backupId, prompt, prompts, selections, {
        cacheOnly: true,
      });
      if (cachedVariants.length > 0) {
        setVariants(cachedVariants);
        setSelectedVariantId(cachedVariants.find((variant) => variant.role !== "collage")?.id ?? "ai-hero");
      }
    } catch (error) {
      toast.error(errorMessage(error, "Could not load saved posters"));
    }
  }, [collageSelections, listing, posterPrompt, variantPrompts]);

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
    window.localStorage.removeItem(`${PROMPT_STORAGE_PREFIX}${listing.backupId}`);
    window.localStorage.removeItem(`${VARIANT_PROMPT_STORAGE_PREFIX}${listing.backupId}`);
    window.localStorage.removeItem(`${COLLAGE_SELECTION_STORAGE_PREFIX}${listing.backupId}`);
  }

  function toggleCollagePhoto(kind: keyof CollageSelections, photoId: number) {
    setCollageSelections((current) => {
      const selected = new Set(current[kind]);
      if (selected.has(photoId)) selected.delete(photoId);
      else selected.add(photoId);
      const next = { ...current, [kind]: Array.from(selected) };
      if (listing) {
        window.localStorage.setItem(
          `${COLLAGE_SELECTION_STORAGE_PREFIX}${listing.backupId}`,
          JSON.stringify(normalizeCollageSelections(next, listing.photos)),
        );
      }
      return next;
    });
  }

  function applyDefaultCollageSelections() {
    if (!listing) return;
    const next = buildDefaultCollageSelections(listing.photos);
    setCollageSelections(next);
    window.localStorage.setItem(`${COLLAGE_SELECTION_STORAGE_PREFIX}${listing.backupId}`, JSON.stringify(next));
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
    collageSelections,
    hasVariants: variants.length > 0,
    coverVariants,
    selectedVariant,
    collageVariants,
    handleListingLoad,
    generatePosters,
    resetPosterPrompt,
    toggleCollagePhoto,
    applyDefaultCollageSelections,
  };
}
