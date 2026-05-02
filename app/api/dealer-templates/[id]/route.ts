import { auth } from "@/lib/auth";
import {
  getDealerTemplateConfig,
  updateDealerTemplateConfig,
} from "@/lib/queries";

interface Params { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const configId = parseInt(id, 10);
  const config = getDealerTemplateConfig(configId);
  if (!config) return Response.json({ error: "Not found" }, { status: 404 });

  const isAdmin = (session.user as { role: string }).role === "admin";
  const sessionDealerId = (session.user as { dealerId?: number | null }).dealerId;
  if (!isAdmin && (config.dealerId === null || sessionDealerId !== config.dealerId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (config.dealerId === null) {
    return Response.json({ error: "Base templates are read-only" }, { status: 403 });
  }

  const body = await request.json() as { name?: string; configJson?: string };
  updateDealerTemplateConfig(configId, { name: body.name, configJson: body.configJson });

  return Response.json({ ok: true });
}
