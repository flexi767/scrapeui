import { requireAuth } from "@/lib/api/auth-helpers";
import { parsePositiveIntParam } from "@/lib/api/db-helpers";
import {
  listDealerTemplateConfigs,
  listAllDealerTemplateConfigs,
  createDealerTemplateConfig,
  getDealerTemplateConfig,
} from "@/lib/queries";

export async function GET(request: Request) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const url = new URL(request.url);
  const dealerIdParam = url.searchParams.get("dealerId");

  const isAdmin = session.user.role === "admin";

  if (isAdmin && !dealerIdParam) {
    return Response.json(listAllDealerTemplateConfigs());
  }

  const dealerId = dealerIdParam ? parsePositiveIntParam(dealerIdParam) : null;
  if (!dealerId) {
    return Response.json({ error: "dealerId required" }, { status: 400 });
  }

  const sessionDealerId = session.user.dealerId;
  if (!isAdmin && sessionDealerId !== dealerId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json(listDealerTemplateConfigs(dealerId));
}

export async function POST(request: Request) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const isAdmin = session.user.role === "admin";
  const body = await request.json() as { dealerId: number; baseTemplateId: number; name: string };

  const { dealerId, baseTemplateId, name } = body;
  if (!dealerId || !baseTemplateId || !name?.trim()) {
    return Response.json({ error: "dealerId, baseTemplateId, and name are required" }, { status: 400 });
  }

  const sessionDealerId = session.user.dealerId;
  if (!isAdmin && sessionDealerId !== dealerId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const base = getDealerTemplateConfig(baseTemplateId);
  if (!base) return Response.json({ error: "Base template not found" }, { status: 404 });

  const id = createDealerTemplateConfig({ dealerId, baseTemplateId, name: name.trim(), configJson: base.configJson });

  return Response.json({ id }, { status: 201 });
}
