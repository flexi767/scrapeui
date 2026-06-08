
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getDealerTemplateConfig, getDealerTemplateDealerContext } from "@/lib/queries";
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
    const dealerContext = getDealerTemplateDealerContext(config.dealerId);
    if (dealerContext) {
      dealerSlug = dealerContext.slug;
      isActive = dealerContext.activeTemplateConfigId === config.id;
      firstListingId = dealerContext.firstListingId;
    }
  }

  return <EditorClient config={config} dealerSlug={dealerSlug} isActive={isActive} firstListingId={firstListingId} />;
}

export async function generateMetadata({ params }: Props) {
  const { configId } = await params;
  const config = getDealerTemplateConfig(parseInt(configId, 10));
  return { title: config ? `Edit: ${config.name}` : "Template Editor" };
}
