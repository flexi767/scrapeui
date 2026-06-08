
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listDealerTemplateConfigRowsForSession, listDealerTemplateDealerOptions } from "@/lib/queries";
import { TemplatesClient } from "./TemplatesClient";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session) redirect("/login");

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
        <h1 className="text-2xl font-bold">Template Configs</h1>
      </div>
      <TemplatesClient mine={mine} bases={bases} dealerOptions={dealerOptions} />
    </div>
  );
}
