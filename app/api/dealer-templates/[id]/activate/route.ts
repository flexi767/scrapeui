import { requireAuth } from "@/lib/api/auth-helpers";
import { getDealerTemplateConfig, activateDealerTemplateConfig } from "@/lib/queries";

interface Params { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const { id } = await params;
  const configId = parseInt(id, 10);
  const config = getDealerTemplateConfig(configId);
  if (!config || config.dealerId === null) {
    return Response.json({ error: "Not found or base template" }, { status: 404 });
  }

  const isAdmin = (session.user as { role: string }).role === "admin";
  const sessionDealerId = (session.user as { dealerId?: number | null }).dealerId;
  if (!isAdmin && sessionDealerId !== config.dealerId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  activateDealerTemplateConfig(configId, config.dealerId);
  return Response.json({ ok: true });
}
