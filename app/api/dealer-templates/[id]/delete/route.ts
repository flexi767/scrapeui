import { requireAuth } from "@/lib/api/auth-helpers";
import { getDealerTemplateConfig, deleteDealerTemplateConfig } from "@/lib/queries";

interface Params { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const { id } = await params;
  const configId = parseInt(id, 10);
  const config = getDealerTemplateConfig(configId);
  if (!config) return Response.json({ error: "Not found" }, { status: 404 });

  if (config.dealerId === null) {
    return Response.json({ error: "Base templates cannot be deleted" }, { status: 403 });
  }

  const isAdmin = (session.user as { role: string }).role === "admin";
  const sessionDealerId = (session.user as { dealerId?: number | null }).dealerId;
  if (!isAdmin && sessionDealerId !== config.dealerId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    deleteDealerTemplateConfig(configId);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
