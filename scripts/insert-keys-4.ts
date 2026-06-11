import Database from 'better-sqlite3';

const db = new Database('/Users/v/dev/scraped/listings.db');

const keys = [
  { id: 'ui.checked', en: 'Checked', bg: 'Проверено', de: 'Geprüft', ru: 'Проверено' },
  { id: 'ui.check_all', en: 'Check all', bg: 'Провери всички', de: 'Alle prüfen', ru: 'Проверить все' },
  { id: 'ui.check_search_positions_desc', en: 'Runs the search-position checker and streams progress here while it updates found and missing ranks.', bg: 'Стартира проверка на позициите в търсачката и показва прогреса в реално време.', de: 'Führt die Suchpositionsprüfung aus und zeigt den Fortschritt in Echtzeit.', ru: 'Запускает проверку позиций в поиске и отображает прогресс в реальном времени.' },
  { id: 'ui.price_on_request', en: 'Price on request', bg: 'Цена при запитване', de: 'Preis auf Anfrage', ru: 'Цена по запросу' },
  { id: 'ui.changes_saved', en: 'Changes saved.', bg: 'Промените са запазени.', de: 'Änderungen gespeichert.', ru: 'Изменения сохранены.' },
  { id: 'ui.draft_saved', en: 'Draft saved.', bg: 'Черновата е запазена.', de: 'Entwurf gespeichert.', ru: 'Черновик сохранён.' },
  { id: 'ui.edit_details', en: 'Edit details', bg: 'Редактирай данните', de: 'Details bearbeiten', ru: 'Редактировать данные' },
  { id: 'ui.show_collapsed_fields', en: 'Show collapsed fields', bg: 'Покажи свитите полета', de: 'Eingeklappte Felder anzeigen', ru: 'Показать свёрнутые поля' },
  { id: 'ui.phone', en: 'Phone', bg: 'Телефон', de: 'Telefon', ru: 'Телефон' },
  { id: 'ui.vin', en: 'VIN', bg: 'VIN', de: 'FIN', ru: 'VIN' },
  { id: 'ui.cars_bg_views', en: 'Cars.bg views', bg: 'Cars.bg преглеждания', de: 'Cars.bg Aufrufe', ru: 'Cars.bg просмотры' },
  { id: 'ui.region', en: 'Region', bg: 'Регион', de: 'Region', ru: 'Регион' },
];

const insertKey = db.prepare(`INSERT OR IGNORE INTO translation_keys (id, context) VALUES (?, 'ui')`);
const insertVal = db.prepare(`INSERT OR REPLACE INTO translations (id, translation_key_id, locale_code, value) VALUES (?, ?, ?, ?)`);

for (const k of keys) {
  insertKey.run(k.id);
  insertVal.run(`${k.id}:en`, k.id, 'en', k.en);
  insertVal.run(`${k.id}:bg`, k.id, 'bg', k.bg);
  insertVal.run(`${k.id}:de`, k.id, 'de', k.de);
  insertVal.run(`${k.id}:ru`, k.id, 'ru', k.ru);
  console.log('inserted', k.id);
}
