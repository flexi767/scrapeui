import { raw } from '@/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/auth-helpers';
import bcrypt from 'bcryptjs';
import { isValidDealerSlug } from '@/lib/dealer-config';
import { currentIsoTimestamp } from '@/lib/date-format';
import { errorMessage } from '@/lib/utils';

// POST /api/dealers/register
// Admin creates a dealer + an associated user account in one step.
export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  const body = await req.json() as Record<string, unknown>;
  const {
    name, slug, mobile_url,
    own = false, priority = 0,
    username, password,
  } = body as {
    name: string; slug: string; mobile_url?: string;
    own?: boolean; priority?: number;
    username: string; password: string;
  };

  if (!name?.trim() || !slug?.trim() || !username?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'name, slug, username, password are required' }, { status: 400 });
  }
  if (!isValidDealerSlug(slug)) {
    return NextResponse.json({ error: 'slug must be lowercase alphanumeric with dashes' }, { status: 400 });
  }
  if ((password as string).length < 6) {
    return NextResponse.json({ error: 'password must be at least 6 characters' }, { status: 400 });
  }

  const now = currentIsoTimestamp();
  const passwordHash = await bcrypt.hash(password as string, 10);

  const insert = raw.transaction(() => {
    const dealerResult = raw.prepare(
      `INSERT INTO dealers (slug, name, mobile_url, own, active, priority, created_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
    ).run(slug, name.trim(), (mobile_url as string) || null, own ? 1 : 0, priority, now);

    const dealerId = dealerResult.lastInsertRowid as number;

    raw.prepare(
      `INSERT INTO users (username, name, password_hash, role, dealer_id, created_at)
       VALUES (?, ?, ?, 'user', ?, ?)`,
    ).run((username as string).trim(), (name as string).trim(), passwordHash, dealerId, now);

    return dealerId;
  });

  try {
    const dealerId = insert();
    return NextResponse.json({ id: dealerId, slug, name }, { status: 201 });
  } catch (err) {
    const msg = errorMessage(err, '');
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'slug or username already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'registration failed' }, { status: 500 });
  }
}
