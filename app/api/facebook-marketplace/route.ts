import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { backupId } = body as { backupId?: unknown };

  if (typeof backupId !== "number" || isNaN(backupId)) {
    return new Response(JSON.stringify({ error: "backupId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const child = spawn(
    path.join(process.cwd(), "node_modules/.bin/tsx"),
    [
      path.join(
        process.cwd(),
        "scraper/scripts/run-facebook-marketplace.ts",
      ),
      "--backup-id",
      String(backupId),
    ],
    {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        HEADLESS: "false",
      },
    },
  );

  child.unref();

  return new Response(
    JSON.stringify({
      ok: true,
      message:
        "Facebook Marketplace browser launching — fill in any missing fields and click Publish.",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
