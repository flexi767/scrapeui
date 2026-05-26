"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage, parseApiResponse } from "@/lib/utils";
import Link from "next/link";
import { CopyIcon, DownloadIcon, SendIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  CarouselOrderStrip,
  CollageImageSelector,
  GeneratedImageSections,
  InstagramPostDataAside,
  PosterPromptPanel,
  VariantPromptPanel,
} from "./InstagramPublisherSections";
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
  dataUrlToFile,
  DEFAULT_POSTER_VARIANT_PROMPTS,
  imageUrlToFile,
  makePoster,
  PROMPT_STORAGE_PREFIX,
  VARIANT_PROMPT_STORAGE_PREFIX,
  type CollageSelections,
  type InstagramListingPayload,
  type PosterVariant,
  type PosterVariantPrompt,
} from "./poster";

interface Props {
  backupId: number;
}

export function InstagramPublisherClient({ backupId }: Props) {
  const [listing, setListing] = useState<InstagramListingPayload | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [sharing, setSharing] = useState(false);
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string; label: string } | null>(null);
  const canvasSeedRef = useRef(0);
  const initialPosterGeneratedRef = useRef(false);

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
  const orderedPhotos = useMemo(() => listing?.photos ?? [], [listing]);
  const generatedVariantOrder = useMemo(
    () => new Map(DEFAULT_POSTER_VARIANT_PROMPTS.map((variant, index) => [variant.id, index])),
    [],
  );
  const zoomItems = useMemo(() => {
    const items: { src: string; alt: string; label: string }[] = [];
    if (selectedVariant) {
      items.push({ src: selectedVariant.dataUrl, alt: "Selected cover", label: "1. Cover" });
    }
    collageVariants.forEach((variant, index) => {
      items.push({
        src: variant.dataUrl,
        alt: variant.name,
        label: `${index + 2}. ${variant.name}`,
      });
    });
    orderedPhotos.forEach((photo, index) => {
      items.push({
        src: photo.url,
        alt: `Listing photo ${index + 1}`,
        label: `${index + collageVariants.length + 2}. Listing ${index + 1}`,
      });
    });
    return items;
  }, [collageVariants, orderedPhotos, selectedVariant]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/instagram/listings/${backupId}`)
      .then((res) => parseApiResponse<InstagramListingPayload>(res, "Could not load listing"))
      .then((data) => {
        if (!cancelled) {
          setListing(data);
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
        }
      })
      .catch((error) => toast.error(errorMessage(error, "Could not load listing")))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [backupId]);

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

  useEffect(() => {
    if (!zoomImage) return;

    function moveZoom(step: number) {
      setZoomImage((current) => {
        if (!current || zoomItems.length === 0) return current;
        const currentIndex = zoomItems.findIndex((item) => item.src === current.src);
        const nextIndex =
          currentIndex === -1
            ? 0
            : (currentIndex + step + zoomItems.length) % zoomItems.length;
        return zoomItems[nextIndex];
      });
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setZoomImage(null);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveZoom(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveZoom(1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomImage, zoomItems]);

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
      if (selected.has(photoId)) {
        selected.delete(photoId);
      } else {
        selected.add(photoId);
      }
      const next = {
        ...current,
        [kind]: Array.from(selected),
      };
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

  async function copyCaption() {
    if (!listing) return;
    await navigator.clipboard.writeText(listing.caption);
    toast.success("Caption copied");
  }

  function downloadCover() {
    if (!selectedVariant) return;
    const link = document.createElement("a");
    link.href = selectedVariant.dataUrl;
    link.download = `instagram-cover-${backupId}-${selectedVariant.id}.jpg`;
    link.click();
  }

  async function shareCarousel() {
    if (!listing || !selectedVariant) return;
    setSharing(true);
    try {
      const files = [
        dataUrlToFile(selectedVariant.dataUrl, `cover-${backupId}.jpg`),
        ...collageVariants.map((variant, index) =>
          dataUrlToFile(variant.dataUrl, `${String(index + 2).padStart(2, "0")}-${variant.id}.jpg`),
        ),
        ...(await Promise.all(
          orderedPhotos.map((photo, index) =>
            imageUrlToFile(photo.url, `${String(index + collageVariants.length + 2).padStart(2, "0")}-${photo.filename}`),
          ),
        )),
      ];

      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
      };
      if (!nav.share || (nav.canShare && !nav.canShare({ files }))) {
        throw new Error("This browser cannot share multiple image files directly.");
      }

      await nav.share({
        title: listing.title,
        text: listing.caption,
        files,
      });
      toast.success("Share sheet opened");
    } catch (error) {
      toast.error(errorMessage(error, "Could not open share sheet"));
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-gray-300">Loading Instagram publisher...</div>;
  }

  if (!listing) {
    return <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-6 text-red-100">Listing could not be loaded.</div>;
  }

  const zoomOverlay = zoomImage ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={zoomImage.label}
      onClick={() => setZoomImage(null)}
    >
      <button
        type="button"
        onClick={() => setZoomImage(null)}
        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white hover:bg-white/10"
        aria-label="Close preview"
      >
        <XIcon className="h-5 w-5" />
      </button>
      <div className="flex max-h-full max-w-full flex-col gap-3" onClick={(event) => event.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={zoomImage.src} alt={zoomImage.alt} className="max-h-[82vh] max-w-[92vw] object-contain" />
        <div className="text-center text-sm font-medium text-white">{zoomImage.label}</div>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      {zoomOverlay}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/editown" className="text-sm text-gray-400 hover:text-white">
            Back to own listings
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Instagram publish</h1>
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
            onClick={downloadCover}
            disabled={!selectedVariant}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-700 px-3 text-sm text-gray-100 hover:bg-gray-800 disabled:opacity-50"
          >
            <DownloadIcon className="h-4 w-4" />
            Cover
          </button>
          <button
            type="button"
            onClick={shareCarousel}
            disabled={!selectedVariant || sharing}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-pink-600 px-3 text-sm font-medium text-white hover:bg-pink-500 disabled:opacity-50"
          >
            <SendIcon className="h-4 w-4" />
            {sharing ? "Preparing..." : "Share carousel"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_420px]">
        <section className="space-y-4">
          <PosterPromptPanel
            prompt={posterPrompt}
            onPromptChange={setPosterPrompt}
            onReset={resetPosterPrompt}
          />
          <VariantPromptPanel
            prompts={variantPrompts}
            onPromptChange={(id, prompt) =>
              setVariantPrompts((current) =>
                current.map((item) => (item.id === id ? { ...item, prompt } : item)),
              )
            }
          />
          <CollageImageSelector
            photos={orderedPhotos}
            selections={collageSelections}
            generating={generating}
            onToggle={toggleCollagePhoto}
            onDefaults={applyDefaultCollageSelections}
            onGenerate={() => void generatePosters(false)}
            onZoom={setZoomImage}
          />
          <GeneratedImageSections
            expectedVariants={variantPrompts}
            coverVariants={coverVariants}
            collageVariants={collageVariants}
            selectedVariantId={selectedVariantId}
            generating={generating}
            generatingVariantIds={generatingVariantIds}
            hasVariants={variants.length > 0}
            onSelectCover={setSelectedVariantId}
            onRegenerate={() => void generatePosters(true)}
            onGenerateVariant={(variantId, force) => void generatePosters(force, variantId)}
            onZoom={setZoomImage}
          />
          <CarouselOrderStrip
            selectedVariant={selectedVariant}
            collageVariants={collageVariants}
            photos={orderedPhotos}
            zoomItems={zoomItems}
            onZoom={setZoomImage}
          />
        </section>
        <InstagramPostDataAside listing={listing} />
      </div>
    </div>
  );
}
