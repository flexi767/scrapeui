import { auth } from "@/lib/auth";
import { getDealerTemplateConfig, updateDealerTemplateConfig } from "@/lib/queries";

interface Params { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const configId = parseInt(id, 10);
  const config = getDealerTemplateConfig(configId);
  if (!config) return Response.json({ error: "Not found" }, { status: 404 });

  if (config.dealerId === null) {
    return Response.json({ error: "Base templates are read-only" }, { status: 403 });
  }

  const isAdmin = (session.user as { role: string }).role === "admin";
  const sessionDealerId = (session.user as { dealerId?: number | null }).dealerId;
  if (!isAdmin && sessionDealerId !== config.dealerId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json() as {
    pageType: 'listingGrid' | 'listingDetail';
    craftState: string;
    name?: string;
  };

  if (!body.pageType || !body.craftState) {
    return Response.json({ error: "pageType and craftState required" }, { status: 400 });
  }

  const existing = JSON.parse(config.configJson) as Record<string, unknown>;
  existing[body.pageType] = JSON.parse(body.craftState);
  const newConfigJson = JSON.stringify(existing);

  updateDealerTemplateConfig(configId, {
    configJson: newConfigJson,
    ...(body.name ? { name: body.name } : {}),
  });

  return Response.json({ ok: true });
}
