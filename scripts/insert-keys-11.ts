import Database from 'better-sqlite3';

const db = new Database('/Users/v/dev/scraped/listings.db');

const keys = [
  {
    id: 'ui.translation_key',
    context: 'ui',
    translations: {
      bg: 'Ключ',
      en: 'Key',
      de: 'Schlüssel',
      ru: 'Ключ',
    },
  },
  {
    id: 'ui.translation_context',
    context: 'ui',
    translations: {
      bg: 'Контекст',
      en: 'Context',
      de: 'Kontext',
      ru: 'Контекст',
    },
  },
  {
    id: 'ui.auto_translate',
    context: 'ui',
    translations: {
      bg: 'Авто',
      en: 'Auto',
      de: 'Auto',
      ru: 'Авто',
    },
  },
  {
    id: 'ui.auto_translation_failed',
    context: 'ui',
    translations: {
      bg: 'Авто-преводът е неуспешен',
      en: 'Auto-translation failed',
      de: 'Automatische Übersetzung fehlgeschlagen',
      ru: 'Автоперевод не выполнен',
    },
  },
  {
    id: 'ui.new_badge',
    context: 'ui',
    translations: {
      bg: 'ново',
      en: 'new',
      de: 'neu',
      ru: 'новое',
    },
  },
  {
    id: 'ui.unique_badge',
    context: 'ui',
    translations: {
      bg: 'уникално',
      en: 'unique',
      de: 'einmalig',
      ru: 'уникальное',
    },
  },
  {
    id: 'ui.imgs',
    context: 'ui',
    translations: {
      bg: 'снимки',
      en: 'imgs',
      de: 'Bilder',
      ru: 'фото',
    },
  },
  {
    id: 'ui.listings_scraped',
    context: 'ui',
    translations: {
      bg: '{dealer}: {count} обяви извлечени',
      en: '{dealer}: {count} listings scraped',
      de: '{dealer}: {count} Inserate gescrapt',
      ru: '{dealer}: {count} объявлений загружено',
    },
  },
  {
    id: 'ui.data_saved',
    context: 'ui',
    translations: {
      bg: 'Данните са запазени',
      en: 'Data saved',
      de: 'Daten gespeichert',
      ru: 'Данные сохранены',
    },
  },
  {
    id: 'ui.sync_failed_to_start',
    context: 'ui',
    translations: {
      bg: 'Синхронизацията не стартира',
      en: 'Sync failed to start',
      de: 'Synchronisation konnte nicht starten',
      ru: 'Синхронизация не запустилась',
    },
  },
  {
    id: 'ui.sync_completed',
    context: 'ui',
    translations: {
      bg: 'Синхронизация завършена: {makes} марки, {models} модела',
      en: 'Sync completed: {makes} makes, {models} models',
      de: 'Synchronisation abgeschlossen: {makes} Marken, {models} Modelle',
      ru: 'Синхронизация завершена: {makes} марок, {models} моделей',
    },
  },
  {
    id: 'ui.sync_exited_with_code',
    context: 'ui',
    translations: {
      bg: 'Синхронизацията приключи с код {code}',
      en: 'Sync exited with code {code}',
      de: 'Synchronisation mit Code {code} beendet',
      ru: 'Синхронизация завершилась с кодом {code}',
    },
  },
  {
    id: 'ui.sync_result_summary',
    context: 'ui',
    translations: {
      bg: 'Синхронизирани {makes} марки и {models} модела. Намерени {makeCounts} броя марки и {modelCounts} броя модели.',
      en: 'Synced {makes} makes and {models} models. Found {makeCounts} make counts and {modelCounts} model counts.',
      de: '{makes} Marken und {models} Modelle synchronisiert. {makeCounts} Markenanzahlen und {modelCounts} Modellanzahlen gefunden.',
      ru: 'Синхронизировано {makes} марок и {models} моделей. Найдено {makeCounts} счётчиков марок и {modelCounts} счётчиков моделей.',
    },
  },
  {
    id: 'ui.make_model_log_detail',
    context: 'ui',
    translations: {
      bg: '{models} модела, брой марка {makeCount}, намерени {modelCounts} броя модели',
      en: '{models} models, make count {makeCount}, model counts found {modelCounts}',
      de: '{models} Modelle, Markenanzahl {makeCount}, Modellanzahlen gefunden {modelCounts}',
      ru: '{models} моделей, счётчик марки {makeCount}, найдено {modelCounts} счётчиков моделей',
    },
  },
  {
    id: 'ui.process_exited_with_code',
    context: 'ui',
    translations: {
      bg: 'Процесът приключи с код {code}',
      en: 'Process exited with code {code}',
      de: 'Prozess mit Code {code} beendet',
      ru: 'Процесс завершился с кодом {code}',
    },
  },
];

const insertKey = db.prepare(`
  INSERT OR IGNORE INTO translation_keys (id, context) VALUES (?, ?)
`);

const insertTranslation = db.prepare(`
  INSERT OR IGNORE INTO translations (id, translation_key_id, locale_code, value)
  VALUES (?, ?, ?, ?)
`);

const run = db.transaction(() => {
  for (const k of keys) {
    insertKey.run(k.id, k.context);
    for (const [locale, value] of Object.entries(k.translations)) {
      insertTranslation.run(`${k.id}:${locale}`, k.id, locale, value);
    }
  }
});

run();
console.log(`Inserted ${keys.length} keys.`);
db.close();
