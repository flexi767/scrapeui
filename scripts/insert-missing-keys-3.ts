/**
 * Insert 50 translation keys used by t() but missing from the DB.
 * Run: npx tsx scripts/insert-missing-keys-3.ts
 */
import { db } from '@/db/client';
import { translationKeys } from '@/db/schema';
import { translateText } from '@/lib/translations/google-translate';
import { upsertTranslation } from '@/lib/translations/upsert';
import { eq } from 'drizzle-orm';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// key → { en, bg? }
// bg is provided for keys with known Bulgarian values; else auto-translated from en.
// Keys with {var} use next-intl interpolation syntax.
const KEYS: { key: string; en: string; bg?: string }[] = [
  // Dashboard time labels
  { key: 'ui.never',          en: 'Never',             bg: 'Никога' },
  { key: 'ui.just_now',       en: 'Just now',          bg: 'Току-що' },
  { key: 'ui.minutes_ago',    en: '{n}m ago',          bg: 'преди {n}м' },
  { key: 'ui.hours_ago',      en: '{n}h ago',          bg: 'преди {n}ч' },
  { key: 'ui.days_ago',       en: '{n}d ago',          bg: 'преди {n}д' },

  // Dashboard nav
  { key: 'ui.mobile_bg',             en: 'Mobile.bg',          bg: 'Mobile.bg' },
  { key: 'ui.mobile_bg_integrations',en: 'Mobile.bg integrations', bg: 'Mobile.bg интеграции' },
  { key: 'ui.cars_bg_sync',          en: 'Cars.bg Sync',       bg: 'Cars.bg синхрон' },

  // Register page
  { key: 'ui.back_to_login',              en: '← Login',                          bg: '← Вход' },
  { key: 'ui.register_as_dealer',         en: 'Register as a dealer',             bg: 'Регистрация на дилър' },
  { key: 'ui.create_dealer_account',      en: 'Create your dealer account',       bg: 'Създайте акаунт на дилър' },
  { key: 'ui.account_section',            en: 'Account',                          bg: 'Акаунт' },
  { key: 'ui.dealer_company_name',        en: 'Dealer / company name',            bg: 'Дилър / фирма' },
  { key: 'ui.dealer_name_placeholder',    en: 'M Motors',                         bg: 'М Моторс' },
  { key: 'ui.slug_label',                 en: 'Slug',                             bg: 'Slug' },
  { key: 'ui.slug_placeholder',           en: 'm-motors',                         bg: 'm-motors' },
  { key: 'ui.own_listing_inventory',      en: 'This is my own listing inventory', bg: 'Това е моят инвентар от обяви' },
  { key: 'ui.priority_label',             en: 'Priority',                         bg: 'Приоритет' },
  { key: 'ui.username_label',             en: 'Username',                         bg: 'Потребителско име' },
  { key: 'ui.password_label',             en: 'Password',                         bg: 'Парола' },
  { key: 'ui.password_hint',              en: '(min. 6 characters)',              bg: '(мин. 6 символа)' },
  { key: 'ui.email_label',                en: 'Email',                            bg: 'Имейл' },
  { key: 'ui.email_placeholder',          en: 'you@example.com',                  bg: 'you@example.com' },
  { key: 'ui.create_account',             en: 'Create account',                   bg: 'Създай акаунт' },
  { key: 'ui.creating_account',           en: 'Creating account…',                bg: 'Създаване на акаунт…' },
  { key: 'ui.register_fields_required',   en: 'Name, slug, username, password and email are required', bg: 'Името, slug, потребителско име, парола и имейл са задължителни' },
  { key: 'ui.registration_failed',        en: 'Registration failed',              bg: 'Регистрацията не бе успешна' },
  { key: 'ui.account_created_please_login', en: 'Account created — please log in', bg: 'Акаунтът е създаден — моля, влезте' },
  { key: 'ui.welcome_name',              en: 'Welcome, {name}!',                 bg: 'Добре дошли, {name}!' },

  // Status / runner controls
  { key: 'ui.idle',             en: 'Idle',        bg: 'Неактивен' },
  { key: 'ui.running',          en: 'Running',     bg: 'Изпълнява се' },
  { key: 'ui.running_ellipsis', en: 'Running…',    bg: 'Изпълнява се…' },
  { key: 'ui.run',              en: 'Run',         bg: 'Стартирай' },
  { key: 'ui.stop',             en: 'Stop',        bg: 'Спри' },
  { key: 'ui.reset',            en: 'Reset',       bg: 'Нулирай' },
  { key: 'ui.reset_views',      en: 'Reset views', bg: 'Нулирай прегледи' },
  { key: 'ui.dry_run',          en: 'Dry run',     bg: 'Тест' },
  { key: 'ui.missing_only',     en: 'Missing only',bg: 'Само липсващи' },
  { key: 'ui.reparse',          en: 'Reparse',     bg: 'Презаредка' },
  { key: 'ui.sync',             en: 'Sync',        bg: 'Синхрон' },
  { key: 'ui.sync_with_count',  en: 'Sync ({count})', bg: 'Синхрон ({count})' },
  { key: 'ui.renew_and_reset',  en: 'Renew & reset',  bg: 'Поднови и нулирай' },
  { key: 'ui.done_renewed_count', en: 'Done: {count} renewed, {failed} failed', bg: 'Готово: {count} подновени, {failed} неуспешни' },
  { key: 'ui.done_reset_count',   en: 'Done: {count} reset, {failed} failed',   bg: 'Готово: {count} нулирани, {failed} неуспешни' },

  // Cars.bg sync toasts
  { key: 'ui.carsbg_sync_finished', en: 'Cars.bg sync finished: {updated} updated, {created} created, {deleted} deleted', bg: 'Cars.bg синхрон завърши: {updated} обновени, {created} създадени, {deleted} изтрити' },
  { key: 'ui.carsbg_plan_ready',    en: 'Cars.bg plan ready: {missing} missing, {diffs} diffs, {stale} stale', bg: 'Cars.bg план готов: {missing} липсващи, {diffs} разлики, {stale} остарели' },

  // Misc
  { key: 'ui.language_label', en: 'Language: {name}', bg: 'Език: {name}' },
  { key: 'ui.alt_preview',    en: '{alt} preview',    bg: '{alt} преглед' },
  { key: 'ui.deep_crawl_desc',     en: 'Fetch full listing details (slower)',       bg: 'Зареди пълни детайли на обявите (по-бавно)' },
  { key: 'ui.download_images_desc',en: 'Download and store listing images locally', bg: 'Изтегли и запази снимките локално' },
];

async function main() {
  for (const item of KEYS) {
    // Ensure the key row exists
    const existing = db.select().from(translationKeys).where(eq(translationKeys.id, item.key)).get();
    if (!existing) {
      db.insert(translationKeys).values({ id: item.key, context: 'ui', pluralRules: 0 }).run();
    }

    // EN
    upsertTranslation(item.key, 'en', item.en);

    // BG — use curated value if provided, else translate
    if (item.bg) {
      upsertTranslation(item.key, 'bg', item.bg);
    } else {
      try {
        const v = await translateText(item.en, 'bg');
        upsertTranslation(item.key, 'bg', v);
        await sleep(80);
      } catch { upsertTranslation(item.key, 'bg', item.en); }
    }

    // DE, RU — always translate
    for (const locale of ['de', 'ru'] as const) {
      try {
        const v = await translateText(item.en, locale);
        upsertTranslation(item.key, locale, v);
        await sleep(80);
      } catch { upsertTranslation(item.key, locale, item.en); }
    }

    console.log('✓', item.key, '=', item.en);
  }
  console.log(`\nDone. ${KEYS.length} keys inserted/updated.`);
}

main().catch(e => { console.error(e); process.exit(1); });
