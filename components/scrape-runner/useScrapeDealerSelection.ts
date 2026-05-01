'use client';

import { useState } from 'react';
import type { ScrapeDealer, ScrapeSource } from '@/components/scrape-runner/types';

function supportsSource(dealer: ScrapeDealer, source: ScrapeSource) {
  return Boolean(source === 'mobile' ? dealer.mobile_url : dealer.cars_url);
}

function getDefaultSelectedDealers(dealers: ScrapeDealer[], source: ScrapeSource) {
  return dealers
    .filter((dealer) => dealer.active && dealer.own && supportsSource(dealer, source))
    .map((dealer) => dealer.slug);
}

export function useScrapeDealerSelection(initialDealers: ScrapeDealer[]) {
  const [source, setSource] = useState<ScrapeSource>('mobile');
  const [selectedDealers, setSelectedDealers] = useState<string[]>(() => getDefaultSelectedDealers(initialDealers, 'mobile'));

  const activeDealers = initialDealers.filter((dealer) => dealer.active);
  const availableDealers = activeDealers.filter((dealer) => supportsSource(dealer, source));
  const activeSlugs = new Set(availableDealers.map((dealer) => dealer.slug));
  const effectiveSelected = selectedDealers.filter((slug) => activeSlugs.has(slug));
  const allActiveSelected = availableDealers.length > 0 && effectiveSelected.length === availableDealers.length;

  const toggleDealer = (slug: string) => {
    setSelectedDealers((prev) =>
      prev.includes(slug) ? prev.filter((selectedSlug) => selectedSlug !== slug) : [...prev, slug],
    );
  };

  const toggleSelectAllDealers = () => {
    setSelectedDealers((prev) => {
      const inactiveSelections = prev.filter((slug) => !activeSlugs.has(slug));
      if (allActiveSelected) return inactiveSelections;
      return [...inactiveSelections, ...availableDealers.map((dealer) => dealer.slug)];
    });
  };

  const selectSource = (nextSource: ScrapeSource) => {
    setSource(nextSource);
    setSelectedDealers(getDefaultSelectedDealers(initialDealers, nextSource));
  };

  return {
    source,
    activeDealers,
    availableDealers,
    effectiveSelected,
    allActiveSelected,
    toggleDealer,
    toggleSelectAllDealers,
    selectSource,
  };
}
