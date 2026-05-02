import { auth } from "@/lib/auth";
import {
  listDealerTemplateConfigs,
  listAllDealerTemplateConfigs,
  createDealerTemplateConfig,
  getDealerTemplateConfig,
} from "@/lib/queries";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const dealerIdParam = url.searchParams.get("dealerId");

  const isAdmin = (session.user as { role: string }).role === "admin";

  if (isAdmin && !dealerIdParam) {
    return Response.json(listAllDealerTemplateConfigs());
  }

  const dealerId = dealerIdParam ? parseInt(dealerIdParam, 10) : null;
  if (!dealerId || isNaN(dealerId)) {
    return Response.json({ error: "dealerId required" }, { status: 400 });
  }

  const sessionDealerId = (session.user as { dealerId?: number | null }).dealerId;
  if (!isAdmin && sessionDealerId !== dealerId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json(listDealerTemplateConfigs(dealerId));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = (session.user as { role: string }).role === "admin";
  const body = await request.json() as { dealerId: number; baseTemplateId: number; name: string };

  const { dealerId, baseTemplateId, name } = body;
  if (!dealerId || !baseTemplateId || !name?.trim()) {
    return Response.json({ error: "dealerId, baseTemplateId, and name are required" }, { status: 400 });
  }

  const sessionDealerId = (session.user as { dealerId?: number | null }).dealerId;
  if (!isAdmin && sessionDealerId !== dealerId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const base = getDealerTemplateConfig(baseTemplateId);
  if (!base) return Response.json({ error: "Base template not found" }, { status: 404 });

  const id = createDealerTemplateConfig({ dealerId, baseTemplateId, name: name.trim(), configJson: base.configJson });

  return Response.json({ id }, { status: 201 });
}
