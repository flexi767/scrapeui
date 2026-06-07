"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { errorMessage, parseApiResponse } from "@/lib/utils";

interface MarketplaceListing {
  backupId: number;
  title?: string | null;
  make?: string | null;
  model?: string | null;
  year?: string | number | null;
  price?: string | number | null;
  mileage?: string | number | null;
  photoUrls?: string[];
}

interface MarketplaceListingsResponse {
  listings?: MarketplaceListing[];
}

export function MarketplacePickerClient() {
  const t = useTranslations('ui');
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadListings();
    }, query.trim() ? 250 : 0);

    async function loadListings() {
      try {
        const params = new URLSearchParams({ limit: "50" });
        const trimmedQuery = query.trim();
        if (trimmedQuery) params.set("search", trimmedQuery);

        setIsLoading(true);
        setStatus(t('loading_listings'));
        const response = await fetch(`/api/facebook-marketplace/listings?${params}`, {
          credentials: "same-origin",
          signal: controller.signal,
        });
        const data = await parseApiResponse<MarketplaceListingsResponse>(response, "Could not load listings");
        setListings(data.listings || []);
        setStatus(`Loaded ${(data.listings || []).length} listings`);
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus(errorMessage(error));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function chooseListing(listing: MarketplaceListing) {
    const openerOrigin = getFacebookOpenerOrigin();
    if (!openerOrigin) {
      setStatus(t('marketplace_open_from_bookmarklet'));
      return;
    }
    if (!window.opener) {
      setStatus(t('marketplace_facebook_tab_unavailable'));
      return;
    }
    window.opener.postMessage({ type: "scrapeui:facebook-marketplace-listing", listing }, openerOrigin);
    setStatus(`Sent backup #${listing.backupId}. You can close this window.`);
    window.setTimeout(() => window.close(), 500);
  }

  return (
    <div className="flex h-screen flex-col bg-slate-900 text-slate-200">
      <header className="border-b border-slate-800 p-3">
        <h1 className="text-[15px] font-semibold text-white">{t('marketplace_title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('marketplace_subtitle')}</p>
      </header>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('search_listings')}
        autoFocus
        className="m-3 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none"
      />

      <div className="min-h-0 flex-1 overflow-auto border-y border-slate-800">
        {listings.length === 0 ? (
          <div className="p-3 font-mono text-xs text-slate-400">
            {emptyStateText({ isLoading, listingCount: listings.length, query, t })}
          </div>
        ) : (
          listings.map((listing) => (
            <button
              key={listing.backupId}
              type="button"
              onClick={() => chooseListing(listing)}
              className="grid min-h-[70px] w-full grid-cols-[64px_minmax(0,1fr)] items-center gap-2.5 border-b border-slate-950 bg-transparent p-2 text-left text-slate-300 hover:bg-blue-700 hover:text-white"
            >
              {listing.photoUrls?.[0] ? (
                <span
                  aria-hidden="true"
                  className="h-[50px] w-16 rounded border border-slate-800 bg-slate-900 bg-cover bg-center"
                  style={{ backgroundImage: `url("${encodeCssUrl(listing.photoUrls[0])}")` }}
                />
              ) : (
                <div className="grid h-[50px] w-16 place-items-center rounded border border-slate-800 bg-slate-900 text-[11px] text-slate-500">
                  {t('no_img')}
                </div>
              )}
              <span className="min-w-0">
                <span className="line-clamp-2 block font-semibold">{listing.title || `Backup #${listing.backupId}`}</span>
                <span className="block text-xs text-slate-400">{listingMeta(listing)}</span>
              </span>
            </button>
          ))
        )}
      </div>

      <div className="p-2.5 font-mono text-xs text-slate-400">{status ?? t('marketplace_waiting')}</div>
    </div>
  );
}

function listingMeta(listing: MarketplaceListing) {
  return [
    listing.year,
    listing.mileage ? `${listing.mileage} km` : "",
    listing.price ? `${listing.price} BGN` : "",
    `${listing.photoUrls?.length || 0} photos`,
  ].filter(Boolean).join(" | ");
}

function encodeCssUrl(value: string) {
  return value.replace(/["\\\n\r\f]/g, (char) => `\\${char}`);
}

function emptyStateText({
  isLoading,
  listingCount,
  query,
  t,
}: {
  isLoading: boolean;
  listingCount: number;
  query: string;
  t: (key: string) => string;
}) {
  if (isLoading) return t('loading_listings');
  if (listingCount === 0) return t('no_listings_available');
  return query.trim() ? t('no_listings_match_search') : t('no_listings_found');
}

function getFacebookOpenerOrigin() {
  const rawOrigin = new URLSearchParams(window.location.search).get("openerOrigin");
  if (!rawOrigin) return null;

  try {
    const origin = new URL(rawOrigin).origin;
    return /^https:\/\/([a-z0-9-]+\.)?facebook\.com$/i.test(origin) ? origin : null;
  } catch {
    return null;
  }
}
