import Database from 'better-sqlite3';
const db = new Database('/Users/v/dev/scraped/listings.db');

const keys = [
  { id: 'ui.undo', en: 'Undo', bg: 'Отмени', de: 'Rückgängig', ru: 'Отменить' },
  { id: 'ui.redo', en: 'Redo', bg: 'Повтори', de: 'Wiederholen', ru: 'Повторить' },
  { id: 'ui.grid_page', en: 'Grid Page', bg: 'Решетъчна страница', de: 'Rasterseite', ru: 'Страница-сетка' },
  { id: 'ui.detail_page', en: 'Detail Page', bg: 'Страница с детайли', de: 'Detailseite', ru: 'Страница деталей' },
  { id: 'ui.hide_preview', en: 'Hide Preview', bg: 'Скрий преглед', de: 'Vorschau ausblenden', ru: 'Скрыть превью' },
  { id: 'ui.activating', en: 'Activating…', bg: 'Активиране…', de: 'Aktivierung…', ru: 'Активация…' },
  { id: 'ui.select_a_block', en: 'Select a block', bg: 'Изберете блок', de: 'Block auswählen', ru: 'Выберите блок' },
  { id: 'ui.refresh', en: 'Refresh', bg: 'Опресни', de: 'Aktualisieren', ru: 'Обновить' },
  { id: 'ui.saved_state', en: 'saved state', bg: 'запазено', de: 'gespeicherter Zustand', ru: 'сохранённое состояние' },
  { id: 'ui.power_hp', en: 'Power [hp]', bg: 'Мощност [к.с.]', de: 'Leistung [PS]', ru: 'Мощность [л.с.]' },
  { id: 'ui.euronorm', en: 'Euro standard', bg: 'Евростандарт', de: 'Euro-Norm', ru: 'Евронорма' },
  { id: 'ui.main_category', en: 'Main category', bg: 'Основна категория', de: 'Hauptkategorie', ru: 'Основная категория' },
  { id: 'ui.engine_cc', en: 'Engine [cc]', bg: 'Кубатура [куб.см]', de: 'Motor [ccm]', ru: 'Объём [куб.см]' },
  { id: 'ui.condition', en: 'Condition', bg: 'Състояние', de: 'Zustand', ru: 'Состояние' },
  { id: 'ui.battery_range', en: 'Range (WLTP) [km]', bg: 'Пробег с едно зареждане (WLTP) [км]', de: 'Reichweite (WLTP) [km]', ru: 'Запас хода (WLTP) [км]' },
  { id: 'ui.battery_capacity', en: 'Battery capacity [kWh]', bg: 'Капацитет на батерията [kWh]', de: 'Batteriekapazität [kWh]', ru: 'Ёмкость батареи [кВт·ч]' },
  { id: 'ui.make_loading', en: 'Make (loading…)', bg: 'Марка (зарежда...)', de: 'Marke (lädt…)', ru: 'Марка (загрузка…)' },
  { id: 'ui.title_label', en: 'Title', bg: 'Заглавие', de: 'Titel', ru: 'Заголовок' },
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
