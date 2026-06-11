import Database from 'better-sqlite3';
const db = new Database('/Users/v/dev/scraped/listings.db');

const keys = [
  { id: 'ui.not_found_in_search', en: 'Not found in search results', bg: 'Не е намерено в резултатите', de: 'Nicht in Suchergebnissen gefunden', ru: 'Не найдено в результатах поиска' },
  { id: 'ui.no_output_yet', en: 'No output yet.', bg: 'Няма изход още.', de: 'Noch keine Ausgabe.', ru: 'Нет вывода.' },
  { id: 'ui.no_saved_searches', en: 'No saved searches yet.', bg: 'Няма запазени търсения.', de: 'Noch keine gespeicherten Suchen.', ru: 'Нет сохранённых поисков.' },
  { id: 'ui.year_label', en: 'Year', bg: 'Година', de: 'Jahr', ru: 'Год' },
  { id: 'ui.entry_label', en: 'Entry', bg: 'Запис', de: 'Eintrag', ru: 'Запись' },
  { id: 'ui.delete_draft', en: 'Delete draft?', bg: 'Изтрий черновата?', de: 'Entwurf löschen?', ru: 'Удалить черновик?' },
  { id: 'ui.delete_draft_for', en: 'This will remove the draft for {title}. This action cannot be undone.', bg: 'Това ще премахне черновата за {title}. Действието не може да бъде отменено.', de: 'Dadurch wird der Entwurf für {title} entfernt. Diese Aktion kann nicht rückgängig gemacht werden.', ru: 'Это удалит черновик для {title}. Действие нельзя отменить.' },
  { id: 'ui.this_listing', en: 'this listing', bg: 'тази обява', de: 'dieses Inserat', ru: 'это объявление' },
  { id: 'ui.deleting', en: 'Deleting…', bg: 'Изтриване…', de: 'Löschen…', ru: 'Удаление…' },
  { id: 'ui.copy', en: 'Copy', bg: 'Копирай', de: 'Kopieren', ru: 'Копировать' },
  { id: 'ui.copy_bookmarklet', en: 'Copy bookmarklet', bg: 'Копирай отметка', de: 'Bookmarklet kopieren', ru: 'Копировать букмарклет' },
  { id: 'ui.open_again', en: 'Open again', bg: 'Отвори отново', de: 'Erneut öffnen', ru: 'Открыть снова' },
  { id: 'ui.bookmarklet_desc', en: 'Save this once as a bookmark URL, then run that bookmark on any mobile.bg results page opened from this button.', bg: 'Запазете го веднъж като URL на отметка, след което го стартирайте на всяка страница с резултати от mobile.bg, отворена от този бутон.', de: 'Speichern Sie dies einmal als Lesezeichen-URL und führen Sie dieses Lesezeichen auf jeder mobile.bg-Ergebnisseite aus.', ru: 'Сохраните однажды как URL закладки, затем запускайте её на любой странице результатов mobile.bg.' },
  { id: 'ui.install_bookmarklet_desc', en: 'Install once, then use it after opening browser searches.', bg: 'Инсталирайте веднъж, след което го използвайте след отваряне на браузър търсения.', de: 'Einmal installieren, dann nach dem Öffnen von Browsersuchen verwenden.', ru: 'Установите один раз, затем используйте после открытия поиска в браузере.' },
  { id: 'ui.total_count', en: '{count} total', bg: '{count} общо', de: '{count} gesamt', ru: '{count} всего' },
  { id: 'ui.orig_price_positions', en: 'Orig #{orig} • Price #{price}', bg: 'Оригинал #{orig} • Цена #{price}', de: 'Orig #{orig} • Preis #{price}', ru: 'Исх. #{orig} • Цена #{price}' },
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
