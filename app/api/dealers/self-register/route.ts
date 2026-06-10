import { raw } from '@/db/client';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { isValidDealerSlug } from '@/lib/dealer-config';
import { currentIsoTimestamp } from '@/lib/date-format';
import { runInsert } from '@/lib/listings/sql';
import { errorMessage } from '@/lib/utils';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const log = logger.child('dealers:self-register');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SelfRegisterSchema = z.object({
  name: z.string(),
  slug: z.string(),
  mobile_url: z.string().optional(),
  own: z.unknown().optional(),
  priority: z.unknown().optional(),
  username: z.string(),
  password: z.string(),
  email: z.string(),
});

const DEFAULT_GRANTED_PAGE_KEYS = ['editown'];

// POST /api/dealers/self-register
// Public, unauthenticated: a prospective dealer creates their own
// dealer + user account and is signed in immediately afterwards.
export async function POST(req: NextRequest) {
  const parsed = SelfRegisterSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
  const {
    name, slug, mobile_url,
    own = false, priority = 0,
    username, password, email,
  } = parsed.data as {
    name: string; slug: string; mobile_url?: string;
    own?: unknown; priority?: unknown;
    username: string; password: string; email: string;
  };

  if (!name?.trim() || !slug?.trim() || !username?.trim() || !password?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'name, slug, username, password and email are required' }, { status: 400 });
  }
  if (!isValidDealerSlug(slug)) {
    return NextResponse.json({ error: 'slug must be lowercase alphanumeric with dashes' }, { status: 400 });
  }
  if ((password as string).length < 6) {
    return NextResponse.json({ error: 'password must be at least 6 characters' }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test((email as string).trim())) {
    return NextResponse.json({ error: 'a valid email address is required' }, { status: 400 });
  }

  const now = currentIsoTimestamp();
  const passwordHash = await bcrypt.hash(password as string, 10);

  const insert = raw.transaction(() => {
    const dealerResult = runInsert(raw, 'dealers', {
      slug,
      name: name.trim(),
      mobile_url: (mobile_url as string) || null,
      own: own ? 1 : 0,
      active: 1,
      priority,
      created_at: now,
    });

    const dealerId = dealerResult.lastInsertRowid as number;

    const userResult = runInsert(raw, 'users', {
      username: (username as string).trim(),
      name: (name as string).trim(),
      email: (email as string).trim(),
      password_hash: passwordHash,
      role: 'user',
      dealer_id: dealerId,
      created_at: now,
    });

    const userId = userResult.lastInsertRowid as number;

    for (const pageKey of DEFAULT_GRANTED_PAGE_KEYS) {
      runInsert(raw, 'user_page_permissions', {
        user_id: userId,
        page_key: pageKey,
        created_at: now,
      });
    }

    return dealerId;
  });

  try {
    const dealerId = insert();
    return NextResponse.json({ id: dealerId, slug, name }, { status: 201 });
  } catch (err) {
    const msg = errorMessage(err, '');
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'slug, username or email already exists' }, { status: 409 });
    }
    log.error('Self-registration failed', err);
    return NextResponse.json({ error: 'registration failed' }, { status: 500 });
  }
}
