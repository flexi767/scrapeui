import { notFound } from "next/navigation";
import { getPublicDealer, getPublicListing } from "@/lib/queries";
import { TEMPLATE_REGISTRY } from "@/components/templates";

interface Props {
  params: Promise<{ slug: string; mobileId: string }>;
}

export default async function PublicListingDetailPage({ params }: Props) {
  const { slug, mobileId } = await params;

  const dealer = getPublicDealer(slug);
  if (!dealer || !dealer.publicEnabled) notFound();

  const listing = getPublicListing(dealer.id, mobileId);
  if (!listing) notFound();

  const Template =
    TEMPLATE_REGISTRY[dealer.template as keyof typeof TEMPLATE_REGISTRY] ??
    TEMPLATE_REGISTRY.bold;

  return <Template.ListingDetail dealer={dealer} listing={listing} />;
}

export async function generateMetadata({ params }: Props) {
  const { slug, mobileId } = await params;
  const dealer = getPublicDealer(slug);
  if (!dealer) return {};
  const listing = getPublicListing(dealer.id, mobileId);
  if (!listing) return {};
  return {
    title: `${listing.make} ${listing.model} ${listing.regYear} — ${dealer.name}`,
  };
}
