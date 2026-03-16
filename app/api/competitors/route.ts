import { raw } from '@/db/client';
import { NextRequest, NextResponse } from 'next/server';

interface CompetitorRow {
  id: number;
  slug: string;
  name: string;
  mobile_url: string;
  active: number;
  created_at: string;
}

export function GET() {
  const rows = raw.prepare('SELECT * FROM competitors ORDER BY name').all() as CompetitorRow[];
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { name, slug, mobile_url } = await req.json();
  if (!name || !slug || !mobile_url) {
    return NextResponse.json({ error: 'name, slug, mobile_url required' }, { status: 400 });
  }
  // Validate slug
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'slug must be lowercase alphanumeric with dashes' }, { status: 400 });
  }
  try {
    const result = raw.prepare(
      'INSERT INTO competitors (slug, name, mobile_url, active, created_at) VALUES (?, ?, ?, 1, ?)'
    ).run(slug, name, mobile_url, new Date().toISOString());
    return NextResponse.json({ id: result.lastInsertRowid, slug, name, mobile_url, active: 1 });
  } catch {
    return NextResponse.json({ error: 'slug already exists' }, { status: 409 });
  }
}
