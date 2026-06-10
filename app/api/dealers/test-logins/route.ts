import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { raw } from '@/db/client';
import { requireAdmin } from '@/lib/api/auth-helpers';
import { DB_PATH } from '@/lib/storage-paths';
import { errorMessage } from '@/lib/utils';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const log = logger.child('dealers:test-logins');

const TestLoginsSchema = z.object({
  ids: z.array(z.number()),
});

interface TestResult {
  ok: boolean;
  reason?: string;
}

function runTest(slug: string): Promise<Record<string, TestResult>> {
  return new Promise((resolve, reject) => {
    const tsxPath = path.join(process.cwd(), 'node_modules/.bin/tsx');
    const scriptPath = path.join(process.cwd(), 'scraper/scripts/test-dealer-logins.ts');

    const child = spawn(
      tsxPath,
      [scriptPath, slug],
      { env: { ...process.env, DB_PATH } },
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
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  const parsed = TestLoginsSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
  const { ids } = parsed.data;
  if (ids.length === 0) {
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
        log.error(`Login test failed for dealer ${d.id}`, err);
        results[d.id] = { error: errorMessage(err, 'Login test failed') };
      }
    }),
  );

  return NextResponse.json(results);
}
