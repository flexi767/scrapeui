import Database from 'better-sqlite3';
const db = new Database('/Users/v/dev/scraped/listings.db');

const keys = [
  { id: 'ui.preview_plan', en: 'Preview plan', bg: 'Преглед на план', de: 'Plan vorschau', ru: 'Предварительный просмотр плана' },
  { id: 'ui.run_live', en: 'Run live', bg: 'Изпълни', de: 'Live ausführen', ru: 'Запустить' },
  { id: 'ui.clear_all', en: 'Clear all', bg: 'Изчисти всички', de: 'Alle löschen', ru: 'Очистить все' },
  { id: 'ui.select_dealers_desc', en: 'Select one or more own dealers for preview or live sync.', bg: 'Изберете един или повече собствени дилъри за преглед или синхронизиране.', de: 'Wählen Sie einen oder mehrere eigene Händler für Vorschau oder Live-Synchronisation.', ru: 'Выберите одного или несколько собственных дилеров для предварительного просмотра или живой синхронизации.' },
  { id: 'ui.manage_translations', en: 'Manage Translations', bg: 'Управление на преводи', de: 'Übersetzungen verwalten', ru: 'Управление переводами' },
  { id: 'ui.template_configs', en: 'Template Configs', bg: 'Конфигурации на шаблони', de: 'Template-Konfigurationen', ru: 'Конфигурации шаблонов' },
  { id: 'ui.description_contact', en: 'Description & Contact', bg: 'Описание и Контакт', de: 'Beschreibung & Kontakt', ru: 'Описание и Контакт' },
  { id: 'ui.additional_info', en: 'Additional information', bg: 'Допълнителна информация', de: 'Zusätzliche Informationen', ru: 'Дополнительная информация' },
  { id: 'ui.contact_info', en: 'Contact details', bg: 'Данни за обратна връзка', de: 'Kontaktdaten', ru: 'Контактные данные' },
  { id: 'ui.mobile_phone', en: 'Mobile phone', bg: 'Мобилен телефон', de: 'Mobiltelefon', ru: 'Мобильный телефон' },
  { id: 'ui.mobile_bg_required_fields', en: 'Blue-highlighted fields are required in Mobile.bg.', bg: 'Оцветените в синьо полета са задължителни в Mobile.bg.', de: 'Blau hervorgehobene Felder sind in Mobile.bg erforderlich.', ru: 'Поля, выделенные синим, обязательны в Mobile.bg.' },
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
