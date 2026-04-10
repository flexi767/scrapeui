"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface DealerOption {
  slug: string;
  name: string;
  own: number;
}

interface CrawlQueueFilterBarProps {
  allDealers: DealerOption[];
  urlTypes: string[];
  statuses: string[];
  total: number;
}

export default function CrawlQueueFilterBar({
  allDealers,
  urlTypes,
  statuses,
  total,
}: CrawlQueueFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentDealers = searchParams.getAll("dealer");
  const currentTypes = searchParams.getAll("url_type");
  const currentStatuses = searchParams.getAll("status");
  const currentSearch = searchParams.get("search") ?? "";

  const [dealerOpen, setDealerOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const dealerRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (dealerRef.current && !dealerRef.current.contains(target))
        setDealerOpen(false);
      if (typeRef.current && !typeRef.current.contains(target))
        setTypeOpen(false);
      if (statusRef.current && !statusRef.current.contains(target))
        setStatusOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function buildParams(overrides: Record<string, string | string[]> = {}) {
    const p = new URLSearchParams();

    for (const dealer of currentDealers) p.append("dealer", dealer);
    for (const type of currentTypes) p.append("url_type", type);
    for (const status of currentStatuses) p.append("status", status);
    if (currentSearch) p.set("search", currentSearch);

    for (const [key, value] of Object.entries(overrides)) {
      p.delete(key);
      if (Array.isArray(value)) {
        for (const item of value) p.append(key, item);
      } else if (value) {
        p.set(key, value);
      }
    }

    p.delete("page");
    return p.toString();
  }

  function onToggle(key: "dealer" | "url_type" | "status", value: string) {
    const current =
      key === "dealer"
        ? currentDealers
        : key === "url_type"
          ? currentTypes
          : currentStatuses;

    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];

    router.push(`/mobilebg/crawl-queue?${buildParams({ [key]: next })}`);
  }

  function onSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.push(`/mobilebg/crawl-queue?${buildParams({ search: value })}`);
    }, 350);
  }

  const selectedDealerLabel =
    currentDealers.length === 0
      ? "Dealers"
      : currentDealers.length === 1
        ? (allDealers.find((d) => d.slug === currentDealers[0])?.name ??
          currentDealers[0])
        : `${currentDealers.length} dealers`;

  const selectedTypeLabel =
    currentTypes.length === 0
      ? "Type"
      : currentTypes.length === 1
        ? currentTypes[0]
        : `${currentTypes.length} types`;

  const selectedStatusLabel =
    currentStatuses.length === 0
      ? "Status"
      : currentStatuses.length === 1
        ? currentStatuses[0]
        : `${currentStatuses.length} statuses`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        key={currentSearch}
        type="search"
        defaultValue={currentSearch}
        placeholder="Search URL or mobile ID..."
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-8 w-64 rounded border border-gray-600 bg-gray-800 px-3 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
      />

      <div className="relative" ref={dealerRef}>
        <button
          onClick={() => setDealerOpen((open) => !open)}
          className={`flex h-8 items-center gap-1.5 rounded border px-3 text-sm text-white transition-colors ${
            currentDealers.length > 0
              ? "border-blue-500 bg-blue-500/10"
              : "border-gray-600 bg-gray-800 hover:border-gray-400"
          }`}
        >
          {selectedDealerLabel}
          <span className="text-gray-400">{dealerOpen ? "▲" : "▼"}</span>
        </button>
        {dealerOpen && (
          <div className="absolute left-0 top-9 z-30 min-w-55 rounded border border-gray-600 bg-gray-800 py-1 shadow-lg">
            {allDealers.map((dealer) => {
              const checked = currentDealers.includes(dealer.slug);
              return (
                <label
                  key={dealer.slug}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle("dealer", dealer.slug)}
                    className="accent-blue-500"
                  />
                  <span>{dealer.name}</span>
                  {Boolean(dealer.own) && (
                    <span className="ml-auto rounded-full bg-emerald-700 px-1.5 text-[10px] text-emerald-100">
                      own
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="relative" ref={typeRef}>
        <button
          onClick={() => setTypeOpen((open) => !open)}
          className={`flex h-8 items-center gap-1.5 rounded border px-3 text-sm text-white transition-colors ${
            currentTypes.length > 0
              ? "border-blue-500 bg-blue-500/10"
              : "border-gray-600 bg-gray-800 hover:border-gray-400"
          }`}
        >
          {selectedTypeLabel}
          <span className="text-gray-400">{typeOpen ? "▲" : "▼"}</span>
        </button>
        {typeOpen && (
          <div className="absolute left-0 top-9 z-30 min-w-50 rounded border border-gray-600 bg-gray-800 py-1 shadow-lg">
            {urlTypes.map((type) => {
              const checked = currentTypes.includes(type);
              return (
                <label
                  key={type}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle("url_type", type)}
                    className="accent-blue-500"
                  />
                  <span>{type}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="relative" ref={statusRef}>
        <button
          onClick={() => setStatusOpen((open) => !open)}
          className={`flex h-8 items-center gap-1.5 rounded border px-3 text-sm text-white transition-colors ${
            currentStatuses.length > 0
              ? "border-blue-500 bg-blue-500/10"
              : "border-gray-600 bg-gray-800 hover:border-gray-400"
          }`}
        >
          {selectedStatusLabel}
          <span className="text-gray-400">{statusOpen ? "▲" : "▼"}</span>
        </button>
        {statusOpen && (
          <div className="absolute left-0 top-9 z-30 min-w-50 rounded border border-gray-600 bg-gray-800 py-1 shadow-lg">
            {statuses.map((status) => {
              const checked = currentStatuses.includes(status);
              return (
                <label
                  key={status}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle("status", status)}
                    className="accent-blue-500"
                  />
                  <span>{status}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <span className="text-sm text-gray-400">{total} entries</span>
    </div>
  );
}
