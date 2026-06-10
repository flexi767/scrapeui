import { canAccessDealer, requireAuth } from "@/lib/api/auth-helpers";
import { parsePositiveIntParam } from "@/lib/api/db-helpers";
import {
  getDealerTemplateConfig,
  updateDealerTemplateConfig,
} from "@/lib/queries";
import { z } from "zod";
import { logger } from "@/lib/logger";

const log = logger.child("dealer-templates");

// configJson is arbitrary JSON stored as a string — accept any string.
const PatchTemplateSchema = z.object({
  name: z.string().optional(),
  configJson: z.string().optional(),
});

interface Params { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const { id } = await params;
  const configId = parsePositiveIntParam(id);
  if (!configId) return Response.json({ error: "Invalid ID" }, { status: 400 });
  const config = getDealerTemplateConfig(configId);
  if (!config) return Response.json({ error: "Not found" }, { status: 404 });

  if (config.dealerId === null || !canAccessDealer(session, config.dealerId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = PatchTemplateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid request body", details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  log.info("Updating template config", { configId });
  updateDealerTemplateConfig(configId, { name: body.name, configJson: body.configJson });

  return Response.json({ ok: true });
}
