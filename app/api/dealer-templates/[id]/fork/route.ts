import { requireAuth } from "@/lib/api/auth-helpers";
import { getDealerTemplateConfig, forkDealerTemplateConfig, createDealerTemplateConfig } from "@/lib/queries";

interface Params { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const { id } = await params;
  const sourceId = parseInt(id, 10);
  const source = getDealerTemplateConfig(sourceId);
  if (!source) return Response.json({ error: "Not found" }, { status: 404 });

  const isAdmin = session.user.role === "admin";
  const sessionDealerId = session.user.dealerId;

  const body = await request.json() as { name: string; dealerId?: number };
  if (!body.name?.trim()) return Response.json({ error: "name required" }, { status: 400 });

  // Forking a base template = create new config from base
  if (source.dealerId === null) {
    const targetDealerId = isAdmin ? body.dealerId : sessionDealerId;
    if (!targetDealerId) return Response.json({ error: "dealerId required" }, { status: 400 });
    if (!isAdmin && sessionDealerId !== targetDealerId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const newId = createDealerTemplateConfig({
      dealerId: targetDealerId,
      baseTemplateId: sourceId,
      name: body.name.trim(),
      configJson: source.configJson,
    });
    return Response.json({ id: newId }, { status: 201 });
  }

  // Forking a dealer config
  if (!isAdmin && sessionDealerId !== source.dealerId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const newId = forkDealerTemplateConfig(sourceId, body.name.trim(), source.dealerId);
  return Response.json({ id: newId }, { status: 201 });
}
