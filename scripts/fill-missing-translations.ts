/**
 * Fill in DB translation values for `ui.*` keys that exist in `translation_keys`
 * but have no rows in `translations` (so they render as raw keys in the UI).
 *
 * Flow mirrors the app: write the EN source value, then auto-translate to the
 * target locales (bg/de/ru) with the same Google Translate helper the
 * /api/translations/translate route uses.
 *
 *   npx tsx scripts/fill-missing-translations.ts          # translate + write
 *   npx tsx scripts/fill-missing-translations.ts --dry    # print only
 */
import { db, raw } from '@/db/client';
import { translations, translationKeys } from '@/db/schema';
import { translationSourceLocale, translationTargetLocales } from '@/i18n/routing';
import { translateText } from '@/lib/translations/google-translate';
import { upsertTranslation } from '@/lib/translations/upsert';
import { eq } from 'drizzle-orm';

const DRY = process.argv.includes('--dry');

// English source strings, derived from the key names and their usage context.
const SOURCE: Record<string, string> = {
  'ui.all_categories': 'All categories',
  'ui.amount_label': 'Amount',
  'ui.battery_capacity_label': 'Battery capacity',
  'ui.battery_range_label': 'Battery range',
  'ui.body_type_label': 'Body type',
  'ui.by_creator': 'Created by',
  'ui.category_label': 'Category',
  'ui.condition_label': 'Condition',
  'ui.confirm_delete_no': 'Cancel',
  'ui.confirm_delete_yes': 'Yes, delete',
  'ui.create_expense': 'Add expense',
  'ui.currency_label': 'Currency',
  'ui.date_label': 'Date',
  'ui.date_range_to': 'to',
  'ui.delete_draft_title': 'Delete draft',
  'ui.delete_expense_confirm': 'Are you sure you want to delete this expense?',
  'ui.delete_image_title': 'Delete image',
  'ui.draft_label': 'Draft',
  'ui.edit_expense': 'Edit expense',
  'ui.engine_cc_label': 'Engine (cc)',
  'ui.error_deleting_image': 'Error deleting image',
  'ui.error_loading_images': 'Error loading images',
  'ui.error_reordering_images': 'Error reordering images',
  'ui.error_uploading_images': 'Error uploading images',
  'ui.euronorm_label': 'Euro norm',
  'ui.expense_title_placeholder': 'Expense title',
  'ui.expenses_count_label': 'Expenses',
  'ui.fuel_label': 'Fuel',
  'ui.images_heading': 'Images',
  'ui.invoice_receipt_label': 'Invoice / Receipt',
  'ui.invoices_receipts': 'Invoices & receipts',
  'ui.labels_label': 'Labels',
  'ui.linked_tasks': 'Linked tasks',
  'ui.loading_short': 'Loading…',
  'ui.main_category_label': 'Main category',
  'ui.make_empty_label': 'All makes',
  'ui.make_label': 'Make',
  'ui.make_label_loading': 'Loading makes…',
  'ui.make_placeholder': 'Select make',
  'ui.model_empty_label': 'All models',
  'ui.model_label': 'Model',
  'ui.model_placeholder': 'Select model',
  'ui.no_active_listings': 'No active listings',
  'ui.no_expenses_found': 'No expenses found',
  'ui.no_files_uploaded': 'No files uploaded',
  'ui.no_images': 'No images',
  'ui.notes_label': 'Notes',
  'ui.optional_notes_placeholder': 'Optional notes',
  'ui.power_label': 'Power',
  'ui.search_across_placeholder': 'Search everything…',
  'ui.searching': 'Searching…',
  'ui.title_label': 'Title',
  'ui.total_label': 'Total',
  'ui.transmission_label': 'Transmission',
  'ui.upload_files': 'Upload files',
  'ui.write_something_placeholder': 'Write something…',
};

// Curated locale values for domain-sensitive keys, mirrored from the canonical
// sibling keys already in the DB (e.g. ui.make, ui.transmission). Machine
// translation mangles these out of context ("Make" -> bg "направи"/verb,
// "Transmission" -> ru "передача инфекции"/disease), so we pin them here.
// Anything not listed falls back to translateText().
const OVERRIDES: Record<string, { bg: string; de: string; ru: string }> = {
  'ui.make_label': { bg: 'Производител', de: 'Hersteller', ru: 'Марка' },
  'ui.make_empty_label': { bg: 'Всички марки', de: 'Alle Marken', ru: 'Все марки' },
  'ui.make_placeholder': { bg: 'Изберете производител', de: 'Hersteller auswählen', ru: 'Выберите марку' },
  'ui.make_label_loading': { bg: 'Зареждане на производители…', de: 'Hersteller werden geladen…', ru: 'Загрузка марок…' },
  'ui.model_label': { bg: 'Модел', de: 'Modell', ru: 'Модель' },
  'ui.model_empty_label': { bg: 'Всички модели', de: 'Alle Modelle', ru: 'Все модели' },
  'ui.model_placeholder': { bg: 'Изберете модел', de: 'Modell auswählen', ru: 'Выберите модель' },
  'ui.body_type_label': { bg: 'Тип тяло', de: 'Karosserietyp', ru: 'Тип кузова' },
  'ui.fuel_label': { bg: 'Гориво', de: 'Kraftstoff', ru: 'Топливо' },
  'ui.transmission_label': { bg: 'Скоростна кутия', de: 'Getriebe', ru: 'Коробка передач' },
  'ui.power_label': { bg: 'Мощност', de: 'Leistung', ru: 'Мощность' },
  'ui.engine_cc_label': { bg: 'Двигател (куб.см)', de: 'Hubraum (cm³)', ru: 'Двигатель (куб.см)' },
  'ui.euronorm_label': { bg: 'Евростандарт', de: 'Euronorm', ru: 'Евростандарт' },
  'ui.amount_label': { bg: 'Сума', de: 'Betrag', ru: 'Сумма' },
  'ui.total_label': { bg: 'Общо', de: 'Gesamt', ru: 'Итого' },
  'ui.currency_label': { bg: 'Валута', de: 'Währung', ru: 'Валюта' },
  'ui.date_label': { bg: 'Дата', de: 'Datum', ru: 'Дата' },
  'ui.date_range_to': { bg: 'до', de: 'bis', ru: 'до' },
  'ui.title_label': { bg: 'Заглавие', de: 'Titel', ru: 'Заголовок' },
  'ui.notes_label': { bg: 'Бележки', de: 'Notizen', ru: 'Примечания' },
  'ui.category_label': { bg: 'Категория', de: 'Kategorie', ru: 'Категория' },
  'ui.labels_label': { bg: 'Етикети', de: 'Etiketten', ru: 'Этикетки' },
  'ui.images_heading': { bg: 'Изображения', de: 'Bilder', ru: 'Изображения' },
  'ui.expenses_count_label': { bg: 'Разходи', de: 'Ausgaben', ru: 'Расходы' },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Sanity: confirm these are exactly the keys with zero translations.
  const missing = raw
    .prepare(
      `SELECT k.id FROM translation_keys k
       WHERE NOT EXISTS (SELECT 1 FROM translations t WHERE t.translation_key_id = k.id)
       ORDER BY k.id`,
    )
    .all() as { id: string }[];

  const missingIds = missing.map((r) => r.id);
  const unmapped = missingIds.filter((id) => !(id in SOURCE));
  const extra = Object.keys(SOURCE).filter((id) => !missingIds.includes(id));

  console.log(`DB reports ${missingIds.length} keys with no translations.`);
  if (unmapped.length) console.warn(`⚠️  No English source mapped for: ${unmapped.join(', ')}`);
  if (extra.length) console.warn(`⚠️  Mapped but not actually missing (will still set EN): ${extra.join(', ')}`);

  for (const key of Object.keys(SOURCE)) {
    // Guard: key must exist in translation_keys
    const keyRow = db.select().from(translationKeys).where(eq(translationKeys.id, key)).get();
    if (!keyRow) {
      console.warn(`skip ${key} — not in translation_keys`);
      continue;
    }

    const en = SOURCE[key];
    const line: string[] = [`${key}`, `en="${en}"`];

    if (!DRY) upsertTranslation(key, translationSourceLocale, en);

    const override = OVERRIDES[key];
    for (const locale of translationTargetLocales) {
      let value = override?.[locale] ?? en;
      if (!override) {
        try {
          value = await translateText(en, locale);
        } catch (err) {
          console.warn(`  translate ${key} -> ${locale} failed, falling back to EN: ${String(err)}`);
        }
        await sleep(120);
      }
      if (!DRY) upsertTranslation(key, locale, value);
      line.push(`${locale}="${value}"`);
    }

    console.log(line.join('  '));
  }

  console.log(DRY ? '\nDry run — no writes.' : '\nDone. Restart the dev server / clear cache to pick up new values.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
