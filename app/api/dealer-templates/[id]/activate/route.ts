import { canAccessDealer, requireAuth } from "@/lib/api/auth-helpers";
import { parsePositiveIntParam } from "@/lib/api/db-helpers";
import { getDealerTemplateConfig, activateDealerTemplateConfig } from "@/lib/queries";

interface Params { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const { id } = await params;
  const configId = parsePositiveIntParam(id);
  if (!configId) return Response.json({ error: "Invalid ID" }, { status: 400 });
  const config = getDealerTemplateConfig(configId);
  if (!config || config.dealerId === null) {
    return Response.json({ error: "Not found or base template" }, { status: 404 });
  }

  if (!canAccessDealer(session, config.dealerId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  activateDealerTemplateConfig(configId, config.dealerId);
  return Response.json({ ok: true });
}
