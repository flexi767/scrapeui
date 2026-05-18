"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadImage } from "@/lib/canvas-utils";
import { errorMessage, parseApiResponse } from "@/lib/utils";
import Link from "next/link";
import { CopyIcon, DownloadIcon, InstagramIcon, RefreshCwIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import {
  buildDefaultPosterPrompt,
  dataUrlToFile,
  formatPosterMileage,
  formatPosterPrice,
  imageUrlToFile,
  makePoster,
  PROMPT_STORAGE_PREFIX,
  type InstagramListingPayload,
  type PosterVariant,
} from "./poster";

interface Props {
  backupId: number;
}

export function InstagramPublisherClient({ backupId }: Props) {
  const [listing, setListing] = useState<InstagramListingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants] = useState<PosterVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState("hero");
  const [posterPrompt, setPosterPrompt] = useState("");
  const [sharing, setSharing] = useState(false);
  const canvasSeedRef = useRef(0);
  const initialPosterGeneratedRef = useRef(false);

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? variants[0],
    [selectedVariantId, variants],
  );

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
          setPosterPrompt(savedPrompt || buildDefaultPosterPrompt(data));
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

  const generatePosters = useCallback(async () => {
    if (!listing) return;
    const prompt = posterPrompt.trim() || buildDefaultPosterPrompt(listing);
    window.localStorage.setItem(`${PROMPT_STORAGE_PREFIX}${listing.backupId}`, prompt);
    const seed = canvasSeedRef.current + 1;
    canvasSeedRef.current = seed;
    setGenerating(true);
    try {
      const loaded = await Promise.all(listing.photos.slice(0, 5).map((photo) => loadImage(photo.url)));
      if (canvasSeedRef.current !== seed) return;
      setVariants([
        { id: "hero", name: "Hero poster", dataUrl: makePoster(listing, loaded, "hero", prompt, seed * 3 + 1) },
        { id: "grid", name: "Triple shot", dataUrl: makePoster(listing, loaded, "grid", prompt, seed * 3 + 2) },
        { id: "editorial", name: "Clean gallery", dataUrl: makePoster(listing, loaded, "editorial", prompt, seed * 3 + 3) },
      ]);
    } catch (error) {
      toast.error(errorMessage(error, "Could not generate posters"));
    } finally {
      if (canvasSeedRef.current === seed) setGenerating(false);
    }
  }, [listing, posterPrompt]);

  useEffect(() => {
    if (!listing || !posterPrompt || initialPosterGeneratedRef.current) return;
    initialPosterGeneratedRef.current = true;
    void generatePosters();
  }, [generatePosters, listing, posterPrompt]);

  function resetPosterPrompt() {
    if (!listing) return;
    const nextPrompt = buildDefaultPosterPrompt(listing);
    setPosterPrompt(nextPrompt);
    window.localStorage.removeItem(`${PROMPT_STORAGE_PREFIX}${listing.backupId}`);
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
        ...(await Promise.all(
          listing.photos.map((photo, index) =>
            imageUrlToFile(photo.url, `${String(index + 2).padStart(2, "0")}-${photo.filename}`),
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

  return (
    <div className="space-y-6">
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
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Poster prompt</h2>
                <p className="mt-1 text-xs text-gray-500">
                  The prompt steers the poster layout, palette, shot count, and visible highlights.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetPosterPrompt}
                  className="inline-flex h-8 items-center rounded-md border border-gray-700 px-3 text-xs text-gray-200 hover:bg-gray-800"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => void generatePosters()}
                  disabled={generating}
                  className="inline-flex h-8 items-center gap-2 rounded-md bg-pink-600 px-3 text-xs font-medium text-white hover:bg-pink-500 disabled:opacity-50"
                >
                  <RefreshCwIcon className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
                  Generate posters
                </button>
              </div>
            </div>
            <textarea
              value={posterPrompt}
              onChange={(event) => setPosterPrompt(event.target.value)}
              rows={6}
              className="w-full resize-y rounded-md border border-gray-700 bg-gray-950 p-3 text-sm leading-6 text-gray-200 outline-none focus:border-pink-400"
            />
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Choose cover</h2>
            <button
              type="button"
              onClick={() => void generatePosters()}
              disabled={generating}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-gray-700 px-3 text-xs text-gray-200 hover:bg-gray-800 disabled:opacity-50"
            >
              <RefreshCwIcon className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
              Regenerate
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {variants.map((variant) => (
              <button
                type="button"
                key={variant.id}
                onClick={() => setSelectedVariantId(variant.id)}
                className={`overflow-hidden rounded-lg border bg-gray-900 text-left transition ${
                  selectedVariantId === variant.id
                    ? "border-pink-400 ring-2 ring-pink-400/30"
                    : "border-gray-800 hover:border-gray-600"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={variant.dataUrl} alt={variant.name} className="aspect-square w-full object-cover" />
                <div className="px-3 py-2 text-sm font-medium text-white">{variant.name}</div>
              </button>
            ))}
            {variants.length === 0 && (
              <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-sm text-gray-400">
                {generating ? "Generating poster options..." : "No poster options yet."}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Carousel order</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {selectedVariant && (
                <div className="w-36 shrink-0 overflow-hidden rounded-lg border border-pink-400 bg-gray-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedVariant.dataUrl} alt="Selected cover" className="aspect-square w-full object-cover" />
                  <div className="px-2 py-1 text-xs text-pink-100">1. Cover</div>
                </div>
              )}
              {listing.photos.map((photo, index) => (
                <a
                  key={photo.id}
                  href={photo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-36 shrink-0 overflow-hidden rounded-lg border border-gray-800 bg-gray-900 hover:border-gray-600"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={`Photo ${index + 1}`} className="aspect-square w-full object-cover" />
                  <div className="px-2 py-1 text-xs text-gray-300">{index + 2}. Photo</div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <InstagramIcon className="h-4 w-4 text-pink-300" />
              Post data
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-gray-800 px-3 py-2">
                <div className="text-xs text-gray-500">Make</div>
                <div className="text-gray-100">{listing.make ?? "-"}</div>
              </div>
              <div className="rounded-md bg-gray-800 px-3 py-2">
                <div className="text-xs text-gray-500">Model</div>
                <div className="text-gray-100">{listing.model ?? "-"}</div>
              </div>
              <div className="rounded-md bg-gray-800 px-3 py-2">
                <div className="text-xs text-gray-500">Mileage</div>
                <div className="text-gray-100">{formatPosterMileage(listing.mileage)}</div>
              </div>
              <div className="rounded-md bg-gray-800 px-3 py-2">
                <div className="text-xs text-gray-500">Price</div>
                <div className="text-gray-100">{formatPosterPrice(listing.price)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Caption</h2>
            <textarea
              value={listing.caption}
              readOnly
              rows={16}
              className="w-full resize-y rounded-md border border-gray-700 bg-gray-950 p-3 text-sm leading-6 text-gray-200"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
