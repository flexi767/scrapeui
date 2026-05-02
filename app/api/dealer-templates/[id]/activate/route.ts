import { auth } from "@/lib/auth";
import { getDealerTemplateConfig, activateDealerTemplateConfig } from "@/lib/queries";

interface Params { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

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
