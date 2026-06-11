import Database from 'better-sqlite3';

const db = new Database('/Users/v/dev/scraped/listings.db');

const keys = [
  {
    id: 'ui.mileage_km',
    context: 'ui',
    translations: {
      bg: 'Пробег [км]',
      en: 'Mileage [km]',
      de: 'Laufleistung [km]',
      ru: 'Пробег [км]',
    },
  },
  {
    id: 'ui.private_seller',
    context: 'ui',
    translations: {
      bg: 'Частно лице',
      en: 'Private seller',
      de: 'Privatverkäufer',
      ru: 'Частное лицо',
    },
  },
  {
    id: 'ui.source_at_orig_position',
    context: 'ui',
    translations: {
      bg: 'Обявата {id} е на оригинална позиция {orig} на тази страница с резултати',
      en: 'Source listing {id} is at original position {orig} on this results page',
      de: 'Quellanzeige {id} ist an Originalposition {orig} auf dieser Ergebnisseite',
      ru: 'Исходное объявление {id} находится на позиции {orig} на этой странице результатов',
    },
  },
  {
    id: 'ui.source_at_both_positions',
    context: 'ui',
    translations: {
      bg: 'Обявата {id} е на оригинална позиция {orig} и локална позиция по цена {sorted} на тази страница с резултати',
      en: 'Source listing {id} is at original position {orig} and local price-sort position {sorted} on this results page',
      de: 'Quellanzeige {id} ist an Originalposition {orig} und lokaler Preisposition {sorted} auf dieser Ergebnisseite',
      ru: 'Исходное объявление {id} находится на позиции {orig} и локальной позиции по цене {sorted} на этой странице результатов',
    },
  },
  {
    id: 'ui.source_not_on_page',
    context: 'ui',
    translations: {
      bg: 'Обявата {id} не е на тази страница с резултати',
      en: 'Source listing {id} is not on this results page',
      de: 'Quellanzeige {id} ist nicht auf dieser Ergebnisseite',
      ru: 'Исходное объявление {id} не находится на этой странице результатов',
    },
  },
  {
    id: 'ui.showing_results',
    context: 'ui',
    translations: {
      bg: 'Показват се {count} резултата от текущото mobile.bg търсене, сортирани локално по ефективна цена',
      en: 'Showing {count} results from the current mobile.bg search, sorted locally by effective price',
      de: '{count} Ergebnisse der aktuellen mobile.bg-Suche, lokal nach effektivem Preis sortiert',
      ru: 'Показано {count} результатов из текущего поиска mobile.bg, отсортированных локально по эффективной цене',
    },
  },
  {
    id: 'ui.pages_range',
    context: 'ui',
    translations: {
      bg: 'Стр. {from}–{to}',
      en: 'Pages {from}–{to}',
      de: 'Seiten {from}–{to}',
      ru: 'Стр. {from}–{to}',
    },
  },
  {
    id: 'ui.page_number',
    context: 'ui',
    translations: {
      bg: 'Стр. {page}',
      en: 'Page {page}',
      de: 'Seite {page}',
      ru: 'Стр. {page}',
    },
  },
  {
    id: 'ui.of_total_pages',
    context: 'ui',
    translations: {
      bg: 'от {total}',
      en: 'of {total}',
      de: 'von {total}',
      ru: 'из {total}',
    },
  },
  {
    id: 'ui.more_pages_available',
    context: 'ui',
    translations: {
      bg: '• има още',
      en: '• more available',
      de: '• mehr verfügbar',
      ru: '• есть ещё',
    },
  },
  {
    id: 'ui.sorts_as',
    context: 'ui',
    translations: {
      bg: 'сортира като {price}',
      en: 'sorts as {price}',
      de: 'sortiert als {price}',
      ru: 'сортируется как {price}',
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
