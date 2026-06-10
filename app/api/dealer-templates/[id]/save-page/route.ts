import { canAccessDealer, requireAuth } from "@/lib/api/auth-helpers";
import { parsePositiveIntParam } from "@/lib/api/db-helpers";
import { getDealerTemplateConfig, updateDealerTemplateConfig } from "@/lib/queries";
import { z } from "zod";
import { logger } from "@/lib/logger";

const log = logger.child("dealer-templates:save-page");

// craftState is an opaque JSON string produced by the page builder.
const SavePageSchema = z.object({
  pageType: z.enum(["listingGrid", "listingDetail"]),
  craftState: z.string(),
  name: z.string().optional(),
});

interface Params { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const { id } = await params;
  const configId = parsePositiveIntParam(id);
  if (!configId) return Response.json({ error: "Invalid ID" }, { status: 400 });
  const config = getDealerTemplateConfig(configId);
  if (!config) return Response.json({ error: "Not found" }, { status: 404 });

  if (config.dealerId === null) {
    return Response.json({ error: "Base templates are read-only" }, { status: 403 });
  }

  if (!canAccessDealer(session, config.dealerId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = SavePageSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid request body", details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;

  log.info("Saving page to template config", { configId, pageType: body.pageType });
  const existing = JSON.parse(config.configJson) as Record<string, unknown>;
  existing[body.pageType] = JSON.parse(body.craftState);
  const newConfigJson = JSON.stringify(existing);

  updateDealerTemplateConfig(configId, {
    configJson: newConfigJson,
    ...(body.name ? { name: body.name } : {}),
  });

  return Response.json({ ok: true });
}
