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
  const body = await req.json() as { dealerSlug?: string; dealerSlugs?: string[] };
  const requestedSlugs = Array.isArray(body.dealerSlugs)
    ? body.dealerSlugs.filter(Boolean)
    : (body.dealerSlug ? [body.dealerSlug] : []);
  if (requestedSlugs.length === 0) {
    return NextResponse.json({ error: 'dealerSlug or dealerSlugs required' }, { status: 400 });
  }

  const slugsUnique = Array.from(new Set(requestedSlugs));
  const placeholders = slugsUnique.map(() => '?').join(',');
  const dealers = raw.prepare(`
    SELECT id, slug, name, mobile_url, mobile_user, mobile_password
    FROM dealers
    WHERE slug IN (${placeholders})
    ORDER BY name
  `).all(...slugsUnique) as DealerRow[];

  const validDealers = dealers.filter((dealer) => dealer.mobile_url && dealer.mobile_user && dealer.mobile_password);
  if (validDealers.length === 0) {
    return NextResponse.json({ error: 'No selected dealers with mobile.bg credentials' }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      const send = (data: BackupProgressEvent | { type: 'error'; message: string }) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        for (let i = 0; i < validDealers.length; i += 1) {
          const dealer = validDealers[i];
          send({ type: 'status', message: `Starting ${dealer.name} (${i + 1}/${validDealers.length})`, dealer: dealer.slug });
          try {
            await backupDealerToDb(raw, {
              id: dealer.id,
              slug: dealer.slug,
              name: dealer.name,
              mobileUrl: dealer.mobile_url!,
              mobileUser: dealer.mobile_user!,
              mobilePassword: dealer.mobile_password!,
            }, raw.name, (event) => send(event));
          } catch (error) {
            send({
              type: 'error',
              message: `${dealer.name}: ${error instanceof Error ? error.message : String(error)}`,
              dealer: dealer.slug,
            });
          }
        }
        send({ type: 'status', message: `Finished ${validDealers.length} dealer backup run(s)` });
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
