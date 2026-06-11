import Database from 'better-sqlite3';
const db = new Database('/Users/v/dev/scraped/listings.db');

const keys = [
  { id: 'ui.diffs', en: 'Diffs', bg: 'Разлики', de: 'Unterschiede', ru: 'Различия' },
  { id: 'ui.stale', en: 'Stale', bg: 'Остарели', de: 'Veraltet', ru: 'Устаревшие' },
  { id: 'ui.created', en: 'Created', bg: 'Създадени', de: 'Erstellt', ru: 'Создано' },
  { id: 'ui.running_live', en: 'Running live', bg: 'Изпълнява се', de: 'Läuft live', ru: 'Выполняется' },
  { id: 'ui.planning', en: 'Planning', bg: 'Планиране', de: 'Planung', ru: 'Планирование' },
  { id: 'ui.last_run_live', en: 'Last run live', bg: 'Последно изпълнение', de: 'Letzter Live-Lauf', ru: 'Последний запуск' },
  { id: 'ui.last_preview', en: 'Last preview', bg: 'Последен преглед', de: 'Letzte Vorschau', ru: 'Последний просмотр' },
  { id: 'ui.manage_permissions_for', en: 'Manage page permissions for {username}', bg: 'Управление на разрешения за {username}', de: 'Seitenberechtigungen verwalten für {username}', ru: 'Управление разрешениями для {username}' },
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
