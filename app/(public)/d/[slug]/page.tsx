import { notFound } from "next/navigation";
import { getPublicDealer, getPublicListings, getDealerTemplateConfig } from "@/lib/queries";
import { TEMPLATE_REGISTRY } from "@/components/templates";
import { renderCraftPage } from "@/lib/template-renderer";
import type { PublicListingFilters } from "@/lib/queries";
import type { RenderData } from "@/lib/template-renderer";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function sp(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

function spNum(v: string | string[] | undefined): number | undefined {
  const n = parseInt(sp(v), 10);
  return isNaN(n) ? undefined : n;
}

export default async function PublicDealerPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;

  const dealer = getPublicDealer(slug);
  if (!dealer || !dealer.publicEnabled) notFound();

  const filters: PublicListingFilters = {
    make: sp(query.make),
    fuel: sp(query.fuel),
    yearFrom: sp(query.yearFrom),
    yearTo: sp(query.yearTo),
    priceMin: spNum(query.priceMin),
    priceMax: spNum(query.priceMax),
    mileageMax: spNum(query.mileageMax),
    sort: sp(query.sort) || "newest",
    page: spNum(query.page) ?? 1,
  };

  const result = getPublicListings(dealer.id, filters);

  if (dealer.activeTemplateConfigId) {
    const config = getDealerTemplateConfig(dealer.activeTemplateConfigId);
    if (config) {
      const renderData: RenderData = {
        dealer,
        listings: result.listings,
        total: result.total,
        page: result.page,
        limit: result.limit,
        makes: result.makes,
      };
      return renderCraftPage(config.configJson, 'listingGrid', renderData);
    }
  }

  const Template =
    TEMPLATE_REGISTRY[dealer.template as keyof typeof TEMPLATE_REGISTRY] ??
    TEMPLATE_REGISTRY.bold;

  return (
    <Template.ListingGrid
      dealer={dealer}
      listings={result.listings}
      total={result.total}
      page={result.page}
      limit={result.limit}
      makes={result.makes}
      filters={filters}
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const dealer = getPublicDealer(slug);
  if (!dealer) return {};
  return {
    title: `${dealer.name} — Car Listings`,
    description: `Browse all available cars from ${dealer.name}`,
  };
}
