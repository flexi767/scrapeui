/**
 * POST /api/listings/reparse
 *
 * Reparse make/model for listings using two strategies:
 *  1. Copy from mobilebg_backups (joined on mobile_id) — most accurate
 *  2. Parse from URL slug (e.g. obiava-{id}-mercedes-benz-gle-350-...)
 *  3. Parse from title using cmmvars.js makes map (fallback)
 *
 * Body (all optional):
 *   { id?: number, dealer?: string, missingOnly?: boolean, dryRun?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { requireAuth } from '@/lib/api/auth-helpers';
import { fetchMakesModels, parseMakeModelSync } from '@/lib/mobile-bg/makes-models';

interface Body {
  id?: number;
  dealer?: string;
  missingOnly?: boolean;
  dryRun?: boolean;
}

interface Row {
  id: number;
  url: string | null;
  title: string;
  make: string | null;
  model: string | null;
  dealer: string;
  b_make: string | null;
  b_model: string | null;
}

// Known make slug → canonical name (sorted longest first for greedy match)
const SLUG_MAKES: [string, string][] = ([
  ['mercedes-benz', 'Mercedes-Benz'],
  ['land-rover',    'Land Rover'],
  ['alfa-romeo',    'Alfa Romeo'],
  ['volkswagen',    'Volkswagen'],
  ['audi',          'Audi'],
  ['bmw',           'BMW'],
  ['porsche',       'Porsche'],
  ['hyundai',       'Hyundai'],
  ['toyota',        'Toyota'],
  ['honda',         'Honda'],
  ['mazda',         'Mazda'],
  ['nissan',        'Nissan'],
  ['subaru',        'Subaru'],
  ['suzuki',        'Suzuki'],
  ['mitsubishi',    'Mitsubishi'],
  ['renault',       'Renault'],
  ['peugeot',       'Peugeot'],
  ['citroen',       'Citroen'],
  ['opel',          'Opel'],
  ['ford',          'Ford'],
  ['skoda',         'Skoda'],
  ['seat',          'SEAT'],
  ['mini',          'MINI'],
  ['tesla',         'Tesla'],
  ['jaguar',        'Jaguar'],
  ['volvo',         'Volvo'],
  ['lexus',         'Lexus'],
  ['jeep',          'Jeep'],
  ['dodge',         'Dodge'],
  ['kia',           'Kia'],
  ['vw',            'VW'],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length);

// Words that signal the end of the model portion in a URL slug
const DESC_WORDS = new Set([
  'amg','exclusive','panorama','podgrev','camera','kamera','distronic','keyless',
  'navi','full','facelift','pack','line','sport','edition','cupe','coupe','sedan',
  'wagon','quattro','xdrive','matic','hybrid','plugin','phev','hev','germany',
  'automatik','klima','face','performance','matrix','laser','burmester',
]);

function parseFromUrl(url: string): { make: string; model: string } | null {
  const m = url.match(/obiava-\d+-(.+)$/);
  if (!m) return null;
  const slug = m[1];
  for (const [makeSlug, makeCanonical] of SLUG_MAKES) {
    if (slug.startsWith(makeSlug + '-') || slug === makeSlug) {
      const rest = slug.slice(makeSlug.length + 1);
      const parts = rest.split('-');
      const modelParts: string[] = [];
      for (const p of parts) {
        if (DESC_WORDS.has(p.toLowerCase())) break;
        modelParts.push(p.charAt(0).toUpperCase() + p.slice(1));
        if (modelParts.length >= 3) break;
      }
      return { make: makeCanonical, model: modelParts.join(' ') };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const body = await req.json() as Body;
  const { id, dealer, missingOnly = false, dryRun = false } = body;

  const makesMap = await fetchMakesModels();

  let query = `
    SELECT l.id, l.url, l.title, l.make, l.model, d.slug AS dealer,
           b.make AS b_make, b.model AS b_model
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    LEFT JOIN mobilebg_backups b ON b.mobile_id = l.mobile_id AND b.make IS NOT NULL AND b.make != ''
    WHERE l.title IS NOT NULL
  `;
  const params: (string | number)[] = [];

  if (id) {
    query += ' AND l.id = ?';
    params.push(id);
  } else if (dealer) {
    query += ' AND d.slug = ?';
    params.push(dealer);
  }
  if (missingOnly) {
    query += " AND (l.make IS NULL OR l.make = '')";
  }

  const rows = raw.prepare(query).all(...params) as Row[];

  const update = raw.prepare(`
    UPDATE listings SET make = ?, model = ?, mobile_make_id = ?, mobile_model_id = ? WHERE id = ?
  `);

  const changes: { id: number; dealer: string; title: string; before: string; after: string; source: string }[] = [];

  for (const row of rows) {
    let newMake: string | null = null;
    let newModel: string | null = null;
    let newMakeId: number | null = null;
    let newModelId: number | null = null;
    let source = '';

    // Strategy 1: backup table
    if (row.b_make) {
      newMake = row.b_make;
      newModel = row.b_model ?? '';
      source = 'backup';
    }
    // Strategy 2: URL slug
    else if (row.url) {
      const parsed = parseFromUrl(row.url);
      if (parsed) { newMake = parsed.make; newModel = parsed.model; source = 'url'; }
    }
    // Strategy 3: title parse
    if (!newMake) {
      const parsed = parseMakeModelSync(row.title, makesMap);
      newMake = parsed.make;
      newModel = parsed.model;
      newMakeId = parsed.mobileMakeId;
      newModelId = parsed.mobileModelId;
      source = 'title';
    }

    if (!newMake) continue;
    if (newMake === (row.make ?? '') && newModel === (row.model ?? '')) continue;

    changes.push({
      id: row.id,
      dealer: row.dealer,
      title: row.title,
      before: `${row.make ?? ''} / ${row.model ?? ''}`,
      after: `${newMake} / ${newModel}`,
      source,
    });
    if (!dryRun) update.run(newMake, newModel, newMakeId, newModelId, row.id);
  }

  return NextResponse.json({ processed: rows.length, changed: changes.length, dryRun, changes });
}
