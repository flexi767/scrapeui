"use client";

import { useEffect, useMemo, useState } from "react";

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

export function MarketplacePickerClient() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Waiting for listings");

  useEffect(() => {
    let cancelled = false;

    async function loadListings() {
      try {
        const response = await fetch("/api/facebook-marketplace/listings?limit=250", { credentials: "same-origin" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        setListings(data.listings || []);
        setStatus(`Loaded ${(data.listings || []).length} listings`);
      } catch (error) {
        if (cancelled) return;
        setStatus(error instanceof Error ? error.message : String(error));
      }
    }

    void loadListings();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return listings
      .filter((listing) => {
        if (!normalizedQuery) return true;
        return [
          listing.title,
          listing.make,
          listing.model,
          listing.year,
          listing.price,
          listing.mileage,
        ].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 100);
  }, [listings, query]);

  function chooseListing(listing: MarketplaceListing) {
    const openerOrigin = new URLSearchParams(window.location.search).get("openerOrigin") || "*";
    if (!window.opener) {
      setStatus("Facebook tab is not available.");
      return;
    }
    window.opener.postMessage({ type: "scrapeui:facebook-marketplace-listing", listing }, openerOrigin);
    setStatus(`Sent backup #${listing.backupId}. You can close this window.`);
    window.setTimeout(() => window.close(), 500);
  }

  return (
    <div className="flex h-screen flex-col bg-slate-900 text-slate-200">
      <header className="border-b border-slate-800 p-3">
        <h1 className="text-[15px] font-semibold text-white">scrapeui Marketplace</h1>
        <p className="mt-1 text-sm text-slate-400">Choose a listing to fill in the Facebook tab.</p>
      </header>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search listings"
        autoFocus
        className="m-3 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none"
      />

      <div className="min-h-0 flex-1 overflow-auto border-y border-slate-800">
        {visibleListings.length === 0 ? (
          <div className="p-3 font-mono text-xs text-slate-400">
            {listings.length === 0 ? "Loading listings..." : "No listings found."}
          </div>
        ) : (
          visibleListings.map((listing) => (
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
                  No img
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

      <div className="p-2.5 font-mono text-xs text-slate-400">{status}</div>
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
