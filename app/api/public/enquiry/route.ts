import { NextRequest } from "next/server";
import { readJsonBody } from "@/lib/api/json-body";
import { getPublicDealer, createDealerEnquiry } from "@/lib/queries";

export const runtime = "nodejs";

interface EnquiryBody {
  slug?: unknown;
  name?: unknown;
  email?: unknown;
  message?: unknown;
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await readJsonBody<EnquiryBody>(req, {});
  const slug = str(body?.slug, 200);
  const name = str(body?.name, 120);
  const email = str(body?.email, 200);
  const message = str(body?.message, 5000);

  if (!slug) return json({ error: "Missing dealer" }, 400);
  if (!name) return json({ error: "Name is required" }, 400);
  if (!email || !EMAIL_RE.test(email)) return json({ error: "A valid email is required" }, 400);
  if (!message) return json({ error: "Message is required" }, 400);

  const dealer = getPublicDealer(slug);
  if (!dealer || !dealer.publicEnabled) return json({ error: "Dealer not found" }, 404);

  createDealerEnquiry({ dealerId: dealer.id, name, email, message });
  return json({ ok: true }, 201);
}
