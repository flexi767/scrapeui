import { raw } from '@/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/auth-helpers';
import { isValidDealerSlug } from '@/lib/dealer-config';
import { currentIsoTimestamp } from '@/lib/date-format';
import {
  PLATFORM_ACCOUNT_COLUMNS,
  getPlatformAccountValues,
  pickNullablePlatformAccountFields,
  type PlatformAccountFields,
} from '@/lib/dealers/platformCredentials';
import {
  SOCIAL_ACCOUNT_COLUMNS,
  getSocialAccountValues,
  pickNullableSocialAccountFields,
  type SocialAccountFields,
} from '@/lib/dealers/socialCredentials';

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
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  const body = await req.json() as Record<string, unknown>;
  const {
    name,
    slug,
    own = false,
    priority = 0,
  } = body;
  const platformFields = pickNullablePlatformAccountFields(body);
  const socialFields = pickNullableSocialAccountFields(body);
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
    const accountValues = [
      ...getPlatformAccountValues(platformFields),
      ...getSocialAccountValues(socialFields),
    ];
    const result = raw.prepare(
      `INSERT INTO dealers (
        slug, name, own, active, priority,
        ${PLATFORM_ACCOUNT_COLUMNS},
        ${SOCIAL_ACCOUNT_COLUMNS},
        created_at
      ) VALUES (?, ?, ?, 1, ?, ${accountValues.map(() => '?').join(', ')}, ?)`
    ).run(
      slug,
      name,
      own ? 1 : 0,
      priority,
      ...accountValues,
      currentIsoTimestamp(),
    );
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
  } catch {
    return NextResponse.json({ error: 'slug already exists' }, { status: 409 });
  }
}
