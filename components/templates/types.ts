import type { PublicDealer, PublicListing, PublicListingDetail, PublicListingFilters } from "@/lib/queries";

export type { PublicDealer, PublicListing, PublicListingDetail, PublicListingFilters };

export interface ListingGridProps {
  dealer: PublicDealer;
  listings: PublicListing[];
  total: number;
  page: number;
  limit: number;
  makes: string[];
  filters: PublicListingFilters;
}

export interface ListingDetailProps {
  dealer: PublicDealer;
  listing: PublicListingDetail;
}
