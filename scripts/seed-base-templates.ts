import Database from "better-sqlite3";
import { DEFAULT_CONFIG_JSON } from "../lib/default-craft-state";

const db = new Database("/Users/v/dev/scraped/listings.db");
const now = new Date().toISOString();

const BASE_TEMPLATES = [
  { name: "Bold" },
  { name: "Executive" },
  { name: "Atlas" },
  { name: "Night" },
  { name: "Sunset" },
  { name: "Pro" },
];

const insert = db.prepare(
  `INSERT OR IGNORE INTO dealer_template_configs
     (dealer_id, base_template_id, name, config_json, created_at, updated_at)
   VALUES (NULL, NULL, ?, ?, ?, ?)`,
);

const insertMany = db.transaction((templates: typeof BASE_TEMPLATES) => {
  for (const t of templates) {
    insert.run(t.name, DEFAULT_CONFIG_JSON, now, now);
  }
});

insertMany(BASE_TEMPLATES);

const rows = db.prepare("SELECT id, name FROM dealer_template_configs WHERE dealer_id IS NULL").all();
console.log("Base templates seeded:");
console.table(rows);
db.close();
