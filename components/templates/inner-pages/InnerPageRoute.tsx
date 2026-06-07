import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPublicDealer } from "@/lib/queries";
import { TEMPLATE_REGISTRY } from "@/components/templates";
import { InnerPage } from "./InnerPage";
import type { InnerPageKind } from "../types";

/**
 * Shared server-side renderer for the static inner-page routes. Resolves the
 * dealer, picks its design's Shell from the registry (falling back to bold),
 * and renders the shared InnerPage content inside it.
 */
export async function renderInnerPage(slug: string, kind: InnerPageKind) {
  const dealer = getPublicDealer(slug);
  if (!dealer || !dealer.publicEnabled) notFound();

  const mod =
    TEMPLATE_REGISTRY[dealer.template as keyof typeof TEMPLATE_REGISTRY] ??
    TEMPLATE_REGISTRY.bold;
  const Shell = mod.Shell ?? TEMPLATE_REGISTRY.bold.Shell;
  if (!Shell) notFound();

  return (
    <Shell dealer={dealer} current={kind}>
      <InnerPage kind={kind} dealer={dealer} />
    </Shell>
  );
}

export async function innerPageMetadata(slug: string, kind: InnerPageKind) {
  const t = await getTranslations('ui');
  const dealer = getPublicDealer(slug);
  if (!dealer) return {};
  const TITLES: Record<InnerPageKind, string> = {
    about: t('inner_page_about'),
    finance: t('inner_page_finance'),
    contact: t('inner_page_contact'),
    privacy: t('inner_page_privacy'),
    terms: t('inner_page_terms'),
  };
  return { title: `${TITLES[kind]} — ${dealer.name}` };
}
