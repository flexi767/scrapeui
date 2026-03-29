import { NextRequest, NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { backupDealerToDb, type BackupProgressEvent } from '@/lib/mobile-bg/backup';

export const runtime = 'nodejs';

interface DealerRow {
  id: number;
  slug: string;
  name: string;
  mobile_url: string | null;
  mobile_user: string | null;
  mobile_password: string | null;
}

export async function POST(req: NextRequest) {
  const { dealerSlug } = await req.json() as { dealerSlug?: string };
  if (!dealerSlug) return NextResponse.json({ error: 'dealerSlug required' }, { status: 400 });

  const dealer = raw.prepare(`
    SELECT id, slug, name, mobile_url, mobile_user, mobile_password
    FROM dealers
    WHERE slug = ?
  `).get(dealerSlug) as DealerRow | undefined;

  if (!dealer || !dealer.mobile_url || !dealer.mobile_user || !dealer.mobile_password) {
    return NextResponse.json({ error: 'Dealer not found or missing mobile.bg credentials' }, { status: 400 });
  }

  const mobileUrl = dealer.mobile_url;
  const mobileUser = dealer.mobile_user;
  const mobilePassword = dealer.mobile_password;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      const send = (data: BackupProgressEvent | { type: 'error'; message: string }) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        await backupDealerToDb(raw, {
          id: dealer.id,
          slug: dealer.slug,
          name: dealer.name,
          mobileUrl,
          mobileUser,
          mobilePassword,
        }, raw.name, (event) => send(event));
      } catch (error) {
        send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
