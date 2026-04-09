import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { raw } from '@/db/client';

interface TestResult {
  ok: boolean;
  reason?: string;
}

function runTest(slug: string): Promise<Record<string, TestResult>> {
  return new Promise((resolve, reject) => {
    const routeDir = path.dirname(fileURLToPath(import.meta.url));
    const scriptPath = path.resolve(routeDir, '../../../../scraper/scripts/test-dealer-logins.js');
    const dbPath =
      process.env.DB_PATH ||
      path.join(process.cwd(), '../scraped/listings.db');

    const child = spawn(
      process.execPath,
      [scriptPath, slug],
      { env: { ...process.env, SCRAPEUI_DB_PATH: dbPath } },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on('close', (code) => {
      const results: Record<string, TestResult> = {};
      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line) as { service: string; ok: boolean; reason?: string };
          results[obj.service] = { ok: obj.ok, reason: obj.reason };
        } catch { /* ignore non-JSON */ }
      }
      if (code !== 0 && Object.keys(results).length === 0) {
        reject(new Error(stderr.trim() || `Script exited with code ${code}`));
      } else {
        resolve(results);
      }
    });

    child.on('error', reject);
  });
}

// POST /api/dealers/test-logins — body: { ids: number[] }
// Tests each dealer and returns results keyed by dealer id
export async function POST(req: NextRequest) {
  const { ids } = await req.json() as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }

  const placeholders = ids.map(() => '?').join(',');
  const dealers = raw
    .prepare(`SELECT id, slug FROM dealers WHERE id IN (${placeholders})`)
    .all(...ids) as { id: number; slug: string }[];

  const results: Record<
    number,
    { 'mobile.bg'?: TestResult; 'cars.bg'?: TestResult; error?: string }
  > = {};

  await Promise.all(
    dealers.map(async (d) => {
      try {
        results[d.id] = await runTest(d.slug);
      } catch (err) {
        results[d.id] = { error: (err as Error).message };
      }
    }),
  );

  return NextResponse.json(results);
}
