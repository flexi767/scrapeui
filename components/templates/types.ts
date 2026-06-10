import type React from "react";
import type { PublicDealer, PublicListing, PublicListingDetail, PublicListingFilters } from "@/lib/queries";

export type { PublicDealer, PublicListing, PublicListingDetail, PublicListingFilters };

export interface ListingGridProps {
  dealer: PublicDealer;
  listings: PublicListing[];
  total: number;
  page: number;
  limit: number;
  nextCursor?: string | null;
  makes: string[];
  filters: PublicListingFilters;
}

export interface ListingDetailProps {
  dealer: PublicDealer;
  listing: PublicListingDetail;
}

/** Static content pages reachable from every design's nav/footer. */
export const INNER_PAGE_KINDS = ["about", "finance", "contact", "privacy", "terms"] as const;
export type InnerPageKind = (typeof INNER_PAGE_KINDS)[number];

/** Active nav highlight key: the listing grid ("cars") or one of the inner pages. */
export type NavKey = "cars" | InnerPageKind;

/**
 * Per-design page chrome (header + footer/nav) wrapping arbitrary page content.
 * Each design implements its own Shell reusing its own CSS module so inner
 * pages inherit that design's look. `current` highlights the active nav item.
 */
export interface ShellProps {
  dealer: PublicDealer;
  current?: NavKey;
  children: React.ReactNode;
}
