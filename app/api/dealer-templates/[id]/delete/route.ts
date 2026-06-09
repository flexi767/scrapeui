import { canAccessDealer, requireAuth } from "@/lib/api/auth-helpers";
import { parsePositiveIntParam } from "@/lib/api/db-helpers";
import { getDealerTemplateConfig, deleteDealerTemplateConfig } from "@/lib/queries";

interface Params { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const { id } = await params;
  const configId = parsePositiveIntParam(id);
  if (!configId) return Response.json({ error: "Invalid ID" }, { status: 400 });
  const config = getDealerTemplateConfig(configId);
  if (!config) return Response.json({ error: "Not found" }, { status: 404 });

  if (config.dealerId === null) {
    return Response.json({ error: "Base templates cannot be deleted" }, { status: 403 });
  }

  if (!canAccessDealer(session, config.dealerId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    deleteDealerTemplateConfig(configId);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
