export const dynamic = 'force-dynamic';

import { renderInnerPage, innerPageMetadata } from "@/components/templates/inner-pages/InnerPageRoute";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return renderInnerPage(slug, "privacy");
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return innerPageMetadata(slug, "privacy");
}
