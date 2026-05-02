"use client";

import { useCallback, useState } from "react";
import type { MakeEntry } from "@/lib/mobile-bg/makes-models";
import type { City } from "@/lib/mobile-bg/regions";
import { fetchCities, fetchMakes } from "@/components/new-listing-form/api";

export function useNewListingLookups(initialMakes: MakeEntry[]) {
  const [makes, setMakes] = useState<MakeEntry[]>(initialMakes);
  const [makesLoading, setMakesLoading] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  const loadCities = useCallback(async (regionValue: string) => {
    if (!regionValue) {
      setCities([]);
      return;
    }

    setCitiesLoading(true);
    try {
      setCities(await fetchCities(regionValue));
    } catch {
      setCities([]);
    } finally {
      setCitiesLoading(false);
    }
  }, []);

  const loadMakes = useCallback(
    async (pubtype: string) => {
      setMakesLoading(true);
      try {
        setMakes(await fetchMakes(pubtype));
      } catch {
        setMakes(initialMakes);
      } finally {
        setMakesLoading(false);
      }
    },
    [initialMakes],
  );

  return {
    makes,
    makesLoading,
    cities,
    citiesLoading,
    setCities,
    loadCities,
    loadMakes,
  };
}
