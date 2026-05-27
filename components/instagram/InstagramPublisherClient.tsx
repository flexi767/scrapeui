"use client";

import { useCallback, useState } from "react";
import { errorMessage } from "@/lib/utils";
import Link from "next/link";
import { CopyIcon, DownloadIcon, SendIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { downloadBrowserUrl, shareFilesOrThrow } from "@/components/publisher/browser-file-actions";
import { usePublisherListing } from "@/components/publisher/usePublisherListing";
import {
  CarouselOrderStrip,
  CollageImageSelector,
  GeneratedImageSections,
  InstagramPostDataAside,
  PosterPromptPanel,
  VariantPromptPanel,
} from "./InstagramPublisherSections";
import {
  dataUrlToFile,
  imageUrlToFile,
  type InstagramListingPayload,
} from "./poster";
import { useInstagramPosterWorkflow } from "./useInstagramPosterWorkflow";
import { useZoomGallery } from "./useZoomGallery";

interface Props {
  backupId: number;
}

export function InstagramPublisherClient({ backupId }: Props) {
  const [sharing, setSharing] = useState(false);
  const [loadedListing, setLoadedListing] = useState<InstagramListingPayload | null>(null);
  const posterWorkflow = useInstagramPosterWorkflow(loadedListing);
  const {
    generating,
    generatingVariantIds,
    selectedVariantId,
    setSelectedVariantId,
    posterPrompt,
    setPosterPrompt,
    variantPrompts,
    setVariantPrompts,
    collageSelections,
    hasVariants,
    coverVariants,
    selectedVariant,
    collageVariants,
    generatePosters,
    resetPosterPrompt,
    toggleCollagePhoto,
    applyDefaultCollageSelections,
    handleListingLoad: loadPosterListing,
  } = posterWorkflow;
  const handleListingLoad = useCallback((data: InstagramListingPayload) => {
    setLoadedListing(data);
    loadPosterListing(data);
  }, [loadPosterListing]);

  const { listing, loading } = usePublisherListing<InstagramListingPayload>(
    `/api/instagram/listings/${backupId}`,
    "Could not load listing",
    handleListingLoad,
  );

  const { orderedPhotos, zoomItems, zoomImage, setZoomImage } = useZoomGallery({
    selectedVariant,
    collageVariants,
    listing,
  });

  async function copyCaption() {
    if (!listing) return;
    await navigator.clipboard.writeText(listing.caption);
    toast.success("Caption copied");
  }

  function downloadCover() {
    if (!selectedVariant) return;
    downloadBrowserUrl(selectedVariant.dataUrl, `instagram-cover-${backupId}-${selectedVariant.id}.jpg`);
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

      await shareFilesOrThrow({
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
            hasVariants={hasVariants}
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
