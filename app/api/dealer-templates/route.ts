import { canAccessDealer, requireAuth } from "@/lib/api/auth-helpers";
import { parsePositiveIntParam } from "@/lib/api/db-helpers";
import {
  listDealerTemplateConfigs,
  listAllDealerTemplateConfigs,
  createDealerTemplateConfig,
  getDealerTemplateConfig,
} from "@/lib/queries";
import { z } from "zod";
import { logger } from "@/lib/logger";

const log = logger.child("dealer-templates");

const CreateTemplateSchema = z.object({
  dealerId: z.number(),
  baseTemplateId: z.number(),
  name: z.string(),
});

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

  if (!canAccessDealer(session, dealerId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json(listDealerTemplateConfigs(dealerId));
}

export async function POST(request: Request) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const parsed = CreateTemplateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid request body", details: parsed.error.flatten() }, { status: 400 });
  const { dealerId, baseTemplateId, name } = parsed.data;
  if (!dealerId || !baseTemplateId || !name?.trim()) {
    return Response.json({ error: "dealerId, baseTemplateId, and name are required" }, { status: 400 });
  }

  if (!canAccessDealer(session, dealerId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const base = getDealerTemplateConfig(baseTemplateId);
  if (!base) {
    log.warn("Base template not found", { baseTemplateId });
    return Response.json({ error: "Base template not found" }, { status: 404 });
  }

  const id = createDealerTemplateConfig({ dealerId, baseTemplateId, name: name.trim(), configJson: base.configJson });

  return Response.json({ id }, { status: 201 });
}
