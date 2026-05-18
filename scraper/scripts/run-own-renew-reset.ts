import { chromium } from 'playwright';
import { getDealerBySlug, type DealerRowFull } from '@/lib/queries';
import { acceptMobileBgCookies, loginMobileBg } from '@/lib/mobile-bg/auth';
import { USER_AGENT } from '@/lib/mobile-bg/constants';
import { parseJson } from '@/lib/utils';
import { emit, formatError } from '@/scraper/lib/runner';


function parseArgs(): { dealerSlugs: string[]; onlyReset: boolean } {
  const slugs: string[] = [];
  const args = process.argv;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--dealer' && i + 1 < args.length) {
      slugs.push(args[i + 1]);
      i += 1;
    }
  }
  return { dealerSlugs: slugs, onlyReset: args.includes('--only-reset') };
}

async function processDealer(
  dealer: DealerRowFull,
  onlyReset: boolean,
  globalStats: { total: number; completed: number; succeeded: number; failed: number },
) {
  emit({ type: 'log', level: 'info', message: `Logging into mobile.bg as ${dealer.slug}…` });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    if (!await loginMobileBg(page, dealer.mobile_user!, dealer.mobile_password!)) {
      throw new Error(`Login failed for ${dealer.slug}`);
    }

    emit({ type: 'log', level: 'info', message: `Navigating to My Ads for ${dealer.name}…` });
    await page.goto('https://www.mobile.bg/pcgi/mobile.cgi?act=6&subact=4&actions=23', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await acceptMobileBgCookies(page);

    // Collect listing IDs from the page
    const pageListings = await page.evaluate((skipRenew) => {
      const results: Array<{ id: string; title: string }> = [];

      if (skipRenew) {
        // Only-reset mode: collect all listing IDs from the reset ("нулирай") links
        const resetLinks = document.querySelectorAll<HTMLAnchorElement>('a[onclick*="ClearViewsConfirm"]');
        for (const a of resetLinks) {
          const match = a.getAttribute('onclick')?.match(/ClearViewsConfirm\('(\d+)'\)/);
          if (!match) continue;
          const id = match[1];
          const row = a.closest('div.item, div, tr');
          const titleEl = row?.querySelector('.title, .mmm');
          const title = titleEl?.textContent?.trim() || id;
          results.push({ id, title });
        }
      } else {
        // Renew+reset mode: only listings with "Обнови БЕЗПЛАТНО"
        const renewLinks = document.querySelectorAll<HTMLAnchorElement>('a.obnovi[onclick*="confirmUpdatePTNew"]');
        for (const a of renewLinks) {
          if (!/Обнови\s+БЕЗПЛАТНО/i.test(a.textContent || '')) continue;
          const match = a.getAttribute('onclick')?.match(/confirmUpdatePTNew\('(\d+)'\)/);
          if (!match) continue;
          const id = match[1];
          const row = a.closest('div.item, div, tr');
          const titleEl = row?.querySelector('.title, .mmm');
          const title = titleEl?.textContent?.trim() || id;
          results.push({ id, title });
        }
      }
      return results;
    }, onlyReset);

    globalStats.total += pageListings.length;
    const action = onlyReset ? 'Reset views for' : 'Renew & reset';

    emit({
      type: 'log', level: 'info',
      message: pageListings.length > 0
        ? `${action} ${pageListings.length} listing${pageListings.length === 1 ? '' : 's'} for ${dealer.name}…`
        : `No eligible listings found for ${dealer.name}.`,
    });

    for (const listing of pageListings) {
      emit({
        type: 'checking',
        ...globalStats,
        mobile_id: listing.id,
        message: `Processing ${listing.title}…`,
      });

      try {
        if (!onlyReset) {
          // Step 1: Renew
          const renewResult = await page.evaluate(async (ida) => {
            const res = await fetch(`/pcgi/pubpt.cgi?ida=${ida}&setflag=1`);
            return { ok: res.ok, status: res.status };
          }, listing.id);

          if (!renewResult.ok) {
            throw new Error(`Renew HTTP ${renewResult.status}`);
          }
          emit({ type: 'log', level: 'info', message: `Renewed ${listing.title}` });
        }

        // Step 2: Reset counters
        const resetResult = await page.evaluate(async (ida) => {
          const res = await fetch(`/pcgi/subscript.cgi?act=7&ida=${ida}`);
          const buf = await res.arrayBuffer().catch(() => new ArrayBuffer(0));
          const text = new TextDecoder('windows-1251').decode(buf);
          return { ok: res.ok, text };
        }, listing.id);

        let resetOk = false;
        if (resetResult.ok) {
          const parsed = parseJson<{ msg?: unknown }>(resetResult.text, {});
          resetOk = parsed.msg === 'Успешно зануляване.' || resetResult.text.includes('Успешно');
        }

        if (!resetOk) {
          emit({ type: 'log', level: 'info', message: `Reset may have failed for ${listing.title}: ${resetResult.text.slice(0, 100)}` });
        }

        globalStats.completed += 1;
        globalStats.succeeded += 1;
        const label = onlyReset
          ? `${listing.title} — ${resetOk ? 'reset' : 'reset may have failed'}`
          : `${listing.title} — renewed${resetOk ? ' & reset' : ''}`;
        emit({
          type: 'result', ...globalStats,
          row: { mobile_id: listing.id, status: 'success', error: null },
          message: label,
        });
      } catch (error) {
        globalStats.completed += 1;
        globalStats.failed += 1;
        emit({
          type: 'result', ...globalStats,
          row: { mobile_id: listing.id, status: 'failed', error: formatError(error) },
          message: `${listing.title} — ${formatError(error)}`,
        });
      }
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const { dealerSlugs, onlyReset } = parseArgs();
  if (dealerSlugs.length === 0) {
    emit({ type: 'error', message: 'Missing --dealer argument' });
    process.exitCode = 1;
    return;
  }

  const dealers: DealerRowFull[] = [];
  for (const slug of dealerSlugs) {
    const dealer = getDealerBySlug(slug);
    if (!dealer?.own || !dealer.active || !dealer.mobile_user || !dealer.mobile_password) {
      emit({ type: 'log', level: 'info', message: `Dealer "${slug}" not found or missing credentials, skipping.` });
      continue;
    }
    dealers.push(dealer);
  }

  if (dealers.length === 0) {
    emit({ type: 'error', message: 'No valid dealers found' });
    process.exitCode = 1;
    return;
  }

  const action = onlyReset ? 'Reset views' : 'Renew & reset';
  emit({
    type: 'start',
    total: 0, completed: 0, succeeded: 0, failed: 0,
    message: `${action} for ${dealers.map((d) => d.name).join(', ')}…`,
  });

  const stats = { total: 0, completed: 0, succeeded: 0, failed: 0 };

  for (const dealer of dealers) {
    try {
      await processDealer(dealer, onlyReset, stats);
    } catch (error) {
      emit({ type: 'log', level: 'info', message: `${dealer.name}: ${formatError(error)}` });
    }
  }

  emit({
    type: 'complete', ...stats,
    message: `Done. ${stats.succeeded} ${onlyReset ? 'reset' : 'renewed'}, ${stats.failed} failed.`,
  });
}

void main().catch((error) => {
  emit({ type: 'error', message: formatError(error) });
  process.exitCode = 1;
});
