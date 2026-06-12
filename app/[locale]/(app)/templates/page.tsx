
import { auth } from "@/lib/auth";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePagePermission } from "@/lib/api/auth-helpers";
import { listDealerTemplateConfigRowsForSession, listDealerTemplateDealerOptions } from "@/lib/queries";

const TemplatesClient = dynamic(
  () => import("./TemplatesClient").then((mod) => mod.TemplatesClient),
  {
    loading: () => <div className="rounded-lg border border-gray-700/60 bg-gray-900/40 p-6 text-sm text-gray-400">Loading templates...</div>,
  },
);

export default async function TemplatesPage() {
  const pageAccess = await requirePagePermission('templates');
  if ('redirect' in pageAccess) redirect(pageAccess.redirect);

  const session = await auth();
  if (!session) return null;

  const t = await getTranslations('ui');
  const user = session.user as { role: string; dealerId: number | null };
  const configs = listDealerTemplateConfigRowsForSession(user);
  const dealerOptions =
    user.role === "admin"
      ? listDealerTemplateDealerOptions()
      : [];

  const bases = configs.filter((c) => c.dealerId === null);
  const mine = configs.filter((c) => c.dealerId !== null);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('template_configs')}</h1>
      </div>
      <TemplatesClient mine={mine} bases={bases} dealerOptions={dealerOptions} />
    </div>
  );
}
