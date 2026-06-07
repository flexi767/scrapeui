import { requireAuth } from "@/lib/api/auth-helpers";
import { getPosterImageProviderOptions } from "../posters/service";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  return Response.json(getPosterImageProviderOptions(), {
    headers: { "Cache-Control": "no-store" },
  });
}
