import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getDealerTemplateConfig } from "@/lib/queries";
import { raw } from "@/db/client";
import { EditorClient } from "./EditorClient";

interface Props { params: Promise<{ configId: string }> }

export default async function EditorPage({ params }: Props) {
  const { configId } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const id = parseInt(configId, 10);
  const config = getDealerTemplateConfig(id);
  if (!config) notFound();

  const user = session.user as { role: string; dealerId?: number | null };
  const isAdmin = user.role === "admin";
  if (!isAdmin && user.dealerId !== config.dealerId) redirect("/templates");

  let dealerSlug: string | null = null;
  let isActive = false;
  let firstListingId: string | null = null;
  if (config.dealerId) {
    const row = raw
      .prepare(`SELECT slug, active_template_config_id FROM dealers WHERE id = ?`)
      .get(config.dealerId) as { slug: string; active_template_config_id: number | null } | undefined;
    if (row) {
      dealerSlug = row.slug;
      isActive = row.active_template_config_id === config.id;
    }
    const firstListing = raw
      .prepare(`SELECT mobile_id FROM listings WHERE dealer_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1`)
      .get(config.dealerId) as { mobile_id: string } | undefined;
    firstListingId = firstListing?.mobile_id ?? null;
  }

  return <EditorClient config={config} dealerSlug={dealerSlug} isActive={isActive} firstListingId={firstListingId} />;
}

export async function generateMetadata({ params }: Props) {
  const { configId } = await params;
  const config = getDealerTemplateConfig(parseInt(configId, 10));
  return { title: config ? `Edit: ${config.name}` : "Template Editor" };
}
