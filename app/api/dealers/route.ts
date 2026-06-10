import { raw } from '@/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/auth-helpers';
import { isValidDealerSlug } from '@/lib/dealer-config';
import { currentIsoTimestamp } from '@/lib/date-format';
import {
  PLATFORM_ACCOUNT_COLUMNS,
  pickNullablePlatformAccountFields,
  type PlatformAccountFields,
} from '@/lib/dealers/platformCredentials';
import {
  SOCIAL_ACCOUNT_COLUMNS,
  pickNullableSocialAccountFields,
  type SocialAccountFields,
} from '@/lib/dealers/socialCredentials';
import { runInsert } from '@/lib/listings/sql';
import { decryptSecret, encryptSecret } from '@/lib/crypto-credentials';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const log = logger.child('dealers');

const CreateDealerSchema = z.object({
  name: z.string(),
  slug: z.string(),
  own: z.unknown().optional(),
  priority: z.unknown().optional(),
}).passthrough();

/** Columns that hold third-party account passwords — must be encrypted at rest. */
const CREDENTIAL_PASSWORD_COLUMNS = [
  'mobile_password',
  'cars_password',
  'facebook_password',
  'instagram_password',
  'tiktok_password',
] as const;

type PasswordColumn = typeof CREDENTIAL_PASSWORD_COLUMNS[number];

interface DealerRow extends PlatformAccountFields<string | null>, SocialAccountFields<string | null> {
  id: number;
  slug: string;
  name: string;
  own: number;
  active: number;
  priority: number;
  public_enabled: number;
  template: string;
  public_domain: string | null;
  active_template_config_id: number | null;
  created_at: string | null;
}

export async function GET() {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  const rows = raw.prepare(`
    SELECT
      id, slug, name, own, active, priority,
      ${PLATFORM_ACCOUNT_COLUMNS},
      ${SOCIAL_ACCOUNT_COLUMNS},
      public_enabled, template, public_domain, active_template_config_id, created_at
    FROM dealers
    ORDER BY priority DESC, name
  `).all() as DealerRow[];

  // Decrypt password fields before returning to client (admin-only endpoint).
  const decryptedRows = rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const col of CREDENTIAL_PASSWORD_COLUMNS) {
      out[col] = decryptSecret(row[col as PasswordColumn] as string | null | undefined);
    }
    return out;
  });
  return NextResponse.json(decryptedRows);
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  const parsed = CreateDealerSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data as Record<string, unknown>;
  const {
    name,
    slug,
    own = false,
    priority = 0,
  } = body;
  const platformFields = pickNullablePlatformAccountFields(body);
  const socialFields = pickNullableSocialAccountFields(body);

  // Encrypt password fields before persisting.
  for (const col of CREDENTIAL_PASSWORD_COLUMNS) {
    if (col in platformFields) {
      (platformFields as unknown as Record<string, unknown>)[col] = encryptSecret(
        (platformFields as unknown as Record<string, unknown>)[col] as string | null | undefined,
      );
    }
    if (col in socialFields) {
      (socialFields as unknown as Record<string, unknown>)[col] = encryptSecret(
        (socialFields as unknown as Record<string, unknown>)[col] as string | null | undefined,
      );
    }
  }
  if (
    typeof name !== 'string' ||
    typeof slug !== 'string' ||
    typeof platformFields.mobile_url !== 'string' ||
    !platformFields.mobile_url
  ) {
    return NextResponse.json({ error: 'name, slug, mobile_url required' }, { status: 400 });
  }
  if (!isValidDealerSlug(slug)) {
    return NextResponse.json({ error: 'slug must be lowercase alphanumeric with dashes' }, { status: 400 });
  }
  try {
    const result = runInsert(raw, 'dealers', {
      slug,
      name,
      own: own ? 1 : 0,
      active: 1,
      priority,
      ...platformFields,
      ...socialFields,
      created_at: currentIsoTimestamp(),
    });
    return NextResponse.json({
      id: result.lastInsertRowid,
      slug,
      name,
      ...platformFields,
      own: own ? 1 : 0,
      active: 1,
      priority,
      ...socialFields,
      public_enabled: 0,
      template: 'bold',
      public_domain: null,
      active_template_config_id: null,
    });
  } catch (err) {
    log.error('Failed to insert dealer', err);
    return NextResponse.json({ error: 'slug already exists' }, { status: 409 });
  }
}
