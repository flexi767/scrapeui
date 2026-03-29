import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';
import * as fs from 'fs';
import * as path from 'path';

const BG_MONTHS: Record<string, string> = {
  'януари': '01', 'февруари': '02', 'март': '03', 'април': '04',
  'май': '05', 'юни': '06', 'юли': '07', 'август': '08',
  'септември': '09', 'октомври': '10', 'ноември': '11', 'декември': '12',
};

function parseRegistration(raw: string | null | undefined): { month: string; year: string } {
  if (!raw) return { month: '', year: '' };
  const lower = String(raw).toLowerCase().trim();
  const yearMatch = lower.match(/(\d{4})/);
  const year = yearMatch ? yearMatch[1] : '';
  let month = '';
  for (const [bg, num] of Object.entries(BG_MONTHS)) {
    if (lower.includes(bg)) { month = num; break; }
  }
  return { month, year };
}

// POST /api/listings/competitors/import
// Imports competitor JSON files from the scrapers data directory into the DB.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const dealers: string[] = body.dealers ?? [];  // e.g. ['peevauto', 'luxcars']; empty = all
  const replace: boolean = body.replace ?? true; // replace existing data for that dealer

  const dataDir = process.env.SCRAPERS_DATA_DIR || path.join(process.cwd(), '../../scrapers/data');

  // Find all competitor JSON files: {slug}_mobilebg
  const files = fs.readdirSync(dataDir).filter(f => {
    if (!dealers.length) return f.match(/^[a-z0-9_]+_mobilebg(\.json)?$/);
    return dealers.some(d => f.startsWith(`${d}_mobilebg`));
  });

  if (!files.length) {
    return NextResponse.json({ error: 'No competitor data files found', dataDir }, { status: 404 });
  }

  const insert = raw.prepare(`
    INSERT OR REPLACE INTO competitor_listings
      (dealer_slug, dealer_name, url, title, make, model, price, currency, vat,
       ad_status, kaparo, is_new, last_edit, reg_month, reg_year, mileage, fuel,
       power, color, snapshot_date, scraped_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  let total = 0;
  const results: Record<string, number> = {};

  for (const file of files) {
    const slugMatch = file.match(/^([a-z0-9_]+)_mobilebg/);
    if (!slugMatch) continue;
    const slug = slugMatch[1];

    if (replace) {
      raw.prepare('DELETE FROM competitor_listings WHERE dealer_slug = ?').run(slug);
    }

    const filePath = path.join(dataDir, file);
    let listings: Record<string, unknown>[];
    try {
      listings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      continue;
    }

    const importMany = raw.transaction((rows: Record<string, unknown>[]) => {
      for (const row of rows) {
        const yearRaw = (row.year as string | undefined) ?? '';
        const { month, year } = parseRegistration(yearRaw);
        const priceObj = row.price as { amount?: number } | undefined;
        const price = priceObj?.amount ?? null;
        const dealerName = String(row.dealer ?? slug);

        insert.run(
          slug,
          dealerName,
          row.url,
          row.title ?? null,
          row.make ?? null,
          row.model ?? null,
          price,
          'EUR',
          row.vat ?? null,
          row.adStatus ?? null,
          row.kaparo ? 1 : 0,
          row.isNew ? 1 : 0,
          row.lastEdit ?? null,
          month || null,
          year || null,
          row.mileage ?? null,
          row.fuel ?? null,
          row.power ?? null,
          row.color ?? null,
          row.snapshotDate ?? null,
          row.scrapedAt ?? null,
        );
      }
      return rows.length;
    });

    const count = importMany(listings);
    results[slug] = count;
    total += count;
  }

  // Resolve make/model from titles using our own listings taxonomy
  const pairs = raw.prepare(
    'SELECT DISTINCT make, model FROM listings WHERE make IS NOT NULL AND model IS NOT NULL ORDER BY LENGTH(make || model) DESC'
  ).all() as { make: string; model: string }[];

  const updateMakeModel = raw.prepare('UPDATE competitor_listings SET make = ?, model = ? WHERE id = ?');
  const unmatched = raw.prepare(
    'SELECT id, title FROM competitor_listings WHERE make IS NULL AND title IS NOT NULL'
  ).all() as { id: number; title: string }[];

  const matchMakeModel = raw.transaction((rows: { id: number; title: string }[]) => {
    for (const row of rows) {
      const t = row.title.trim().toLowerCase();
      for (const { make, model } of pairs) {
        if (t.startsWith(`${make} ${model}`.toLowerCase())) {
          updateMakeModel.run(make, model, row.id);
          break;
        }
        if (t.startsWith(make.toLowerCase())) {
          updateMakeModel.run(make, null, row.id);
          break;
        }
      }
    }
  });
  matchMakeModel(unmatched);

  return NextResponse.json({ ok: true, total, results });
}

// GET /api/listings/competitors/import - return current counts
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const counts = raw.prepare(`
    SELECT dealer_slug, dealer_name, COUNT(*) as count, MAX(scraped_at) as latest
    FROM competitor_listings
    GROUP BY dealer_slug
  `).all() as { dealer_slug: string; dealer_name: string; count: number; latest: string }[];

  return NextResponse.json({ counts });
}
