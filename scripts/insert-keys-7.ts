import Database from 'better-sqlite3';
const db = new Database('/Users/v/dev/scraped/listings.db');

const keys = [
  { id: 'ui.dashboard_always_visible', en: 'Dashboard (always visible)', bg: 'Табло (винаги видимо)', de: 'Dashboard (immer sichtbar)', ru: 'Панель (всегда видна)' },
  { id: 'ui.save_permissions', en: 'Save permissions', bg: 'Запази разрешения', de: 'Berechtigungen speichern', ru: 'Сохранить разрешения' },
  { id: 'ui.permissions_updated_for', en: 'Permissions updated for {username}', bg: 'Разрешенията са обновени за {username}', de: 'Berechtigungen aktualisiert für {username}', ru: 'Разрешения обновлены для {username}' },
  { id: 'ui.page_listings', en: 'Listings', bg: 'Обяви', de: 'Inserate', ru: 'Объявления' },
  { id: 'ui.page_editown', en: 'Edit Own', bg: 'Редакция собствени', de: 'Eigene bearbeiten', ru: 'Редактировать свои' },
  { id: 'ui.page_mobilebg', en: 'Mobile.bg', bg: 'Mobile.bg', de: 'Mobile.bg', ru: 'Mobile.bg' },
  { id: 'ui.page_tasks', en: 'Tasks', bg: 'Задачи', de: 'Aufgaben', ru: 'Задачи' },
  { id: 'ui.page_expenses', en: 'Expenses', bg: 'Разходи', de: 'Ausgaben', ru: 'Расходы' },
  { id: 'ui.page_templates', en: 'Templates', bg: 'Шаблони', de: 'Vorlagen', ru: 'Шаблоны' },
  { id: 'ui.page_translations', en: 'Translations', bg: 'Преводи', de: 'Übersetzungen', ru: 'Переводы' },
  { id: 'ui.page_config', en: 'Config', bg: 'Настройки', de: 'Konfiguration', ru: 'Настройки' },
  { id: 'ui.page_mapping', en: 'Mapping', bg: 'Картографиране', de: 'Zuordnung', ru: 'Сопоставление' },
  { id: 'ui.page_kb', en: 'Knowledge Base', bg: 'База знания', de: 'Wissensdatenbank', ru: 'База знаний' },
  { id: 'ui.page_files', en: 'Files', bg: 'Файлове', de: 'Dateien', ru: 'Файлы' },
  { id: 'ui.page_dealers', en: 'Dealers', bg: 'Дилъри', de: 'Händler', ru: 'Дилеры' },
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
