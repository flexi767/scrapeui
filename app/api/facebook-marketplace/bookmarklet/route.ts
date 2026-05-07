import { readFile, stat } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Private-Network": "true",
};

const scriptPath = path.join(process.cwd(), "public", "bookmarklets", "facebook-marketplace.js");

let cachedScript:
  | {
      mtimeMs: number;
      value: string;
    }
  | null = null;

async function getBookmarkletScript(): Promise<string> {
  const scriptStat = await stat(scriptPath);
  if (cachedScript?.mtimeMs === scriptStat.mtimeMs) {
    return cachedScript.value;
  }

  const value = await readFile(scriptPath, "utf8");
  cachedScript = { mtimeMs: scriptStat.mtimeMs, value };
  return value;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const script = await getBookmarkletScript();

  return new Response(script, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
