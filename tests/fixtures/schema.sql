CREATE TABLE dealers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slug            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    mobile_url      TEXT,
    own             INTEGER DEFAULT 0,
    active          INTEGER DEFAULT 1,
    mobile_user     TEXT,
    mobile_password TEXT,
    cars_user       TEXT,
    cars_password   TEXT,
    created_at      TEXT
  , priority INTEGER DEFAULT 0, cars_url TEXT, public_domain TEXT, template TEXT NOT NULL DEFAULT 'bold', public_enabled INTEGER NOT NULL DEFAULT 0, active_template_config_id INTEGER
  REFERENCES dealer_template_configs(id) ON DELETE SET NULL, facebook_user TEXT, facebook_password TEXT, instagram_user TEXT, instagram_password TEXT, tiktok_user TEXT, tiktok_password TEXT, public_content TEXT);
CREATE TABLE listing_snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id  INTEGER REFERENCES listings(id),
    price       INTEGER,
    vat         TEXT,
    recorded_at TEXT
  , last_edit TEXT, ad_status TEXT, kaparo INTEGER, title TEXT, description TEXT, views integer);
CREATE INDEX idx_snapshots_listing_id  ON listing_snapshots(listing_id);
CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`action` text NOT NULL,
	`detail` text,
	`user_id` integer,
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `article_dealers` (
	`article_id` integer NOT NULL,
	`dealer_id` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `article_expenses` (
	`article_id` integer NOT NULL,
	`expense_id` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `article_labels` (
	`article_id` integer NOT NULL,
	`label_id` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `article_listings` (
	`article_id` integer NOT NULL,
	`listing_id` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `article_tasks` (
	`article_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`body` text NOT NULL,
	`author_id` integer NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX `articles_slug_unique` ON `articles` (`slug`);
CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`author_id` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `expense_labels` (
	`expense_id` integer NOT NULL,
	`label_id` integer NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `expense_listings` (
	`expense_id` integer NOT NULL,
	`listing_id` integer NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `expense_tasks` (
	`expense_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `labels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#6b7280' NOT NULL
);
CREATE UNIQUE INDEX `labels_name_unique` ON `labels` (`name`);
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`title` text NOT NULL,
	`read_at` text,
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `task_deps` (
	`task_id` integer NOT NULL,
	`depends_on_id` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depends_on_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `task_labels` (
	`task_id` integer NOT NULL,
	`label_id` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `task_listings` (
	`task_id` integer NOT NULL,
	`listing_id` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'backlog' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`assignee_id` integer,
	`created_by_id` integer,
	`parent_id` integer,
	`deadline` text,
	`is_recurring` integer DEFAULT 0,
	`recur_rule` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `time_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`description` text,
	`duration_minutes` integer NOT NULL,
	`date` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `uploads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`stored_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`entity_type` text,
	`entity_id` integer,
	`uploaded_by_id` integer,
	`created_at` text,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text
, dealer_id INTEGER REFERENCES dealers(id), email TEXT);
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
CREATE TABLE IF NOT EXISTS "listings" (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mobile_id` text,
	`price_change` integer,
	`dealer_id` integer,
	`url` text,
	`title` text,
	`make` text,
	`model` text,
	`reg_month` text,
	`reg_year` text,
	`fuel` text,
	`color` text,
	`power` integer,
	`mileage` integer,
	`description` text,
	`ad_status` text,
	`kaparo` integer,
	`is_new` integer,
	`last_edit` text,
	`current_price` integer,
	`vat` text,
	`image_count` integer,
	`image_meta` text,
	`thumb_keys` text,
	`full_keys` text,
	`images_downloaded` integer DEFAULT 0,
	`first_seen_at` text,
	`last_seen_at` text,
	`is_active` integer DEFAULT 1, mobile_make_id INTEGER, mobile_model_id INTEGER, cars_make_id INTEGER, cars_model_id INTEGER, body_type TEXT, transmission TEXT, cars_id TEXT, cars_synced_at TEXT, source text DEFAULT 'm', duplicate integer DEFAULT 0, views integer, deleted_at text, thumb_saved integer DEFAULT 0, vin text, extras_json text, euronorm integer, carsbg_created_date text, carsbg_title text, carsbg_edited_date text, cars_total_views integer, cars_images text, cars_price integer,
	FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX `listings_mobile_id_unique` ON `listings` (`mobile_id`);
CREATE TABLE IF NOT EXISTS "expenses" (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  title text NOT NULL,
  amount integer NOT NULL,
  currency text DEFAULT 'EUR' NOT NULL,
  date text NOT NULL,
  category text NOT NULL,
  notes text,
  created_by_id integer,
  created_at text,
  updated_at text,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON UPDATE no action ON DELETE no action
);
CREATE TABLE IF NOT EXISTS "mobilebg_crawl_runs" (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `dealer_id` integer,
  `status` text DEFAULT 'pending' NOT NULL,
  `source_url` text,
  `listings_count` integer DEFAULT 0,
  `images_count` integer DEFAULT 0,
  `notes` text,
  `started_at` text,
  `finished_at` text,
  `created_at` text,
  `updated_at` text, images_downloaded INTEGER NOT NULL DEFAULT 0, images_failed INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `mobilebg_backup_images` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `backup_id` integer NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `filename` text NOT NULL,
  `source_url` text,
  `local_path` text NOT NULL,
  `created_at` text,
  FOREIGN KEY (`backup_id`) REFERENCES `mobilebg_backups`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `mobilebg_edit_form_snapshots` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `dealer_id` integer,
  `listing_id` integer,
  `backup_id` integer,
  `mobile_id` text,
  `source_url` text,
  `listing_token` text,
  `row_title` text,
  `row_price_text` text,
  `form_url` text,
  `forms_json` text,
  `fields_json` text,
  `checked_boxes_json` text,
  `checked_radios_json` text,
  `hidden_json` text,
  `screenshot_path` text,
  `created_at` text, row_updated_text text, row_refresh_text text, row_viewed_at text, updated_on text, viewed_since_date text, views integer, watching integer,
  FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`backup_id`) REFERENCES `mobilebg_backups`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `mobilebg_repost_jobs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `dealer_id` integer,
  `backup_id` integer,
  `listing_id` integer,
  `source_mobile_id` text,
  `target_mobile_id` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `message` text,
  `preview_screenshot_path` text,
  `debug_dir` text,
  `started_at` text,
  `finished_at` text,
  `created_at` text,
  FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`backup_id`) REFERENCES `mobilebg_backups`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE INDEX idx_listings_mobile_id    ON listings(mobile_id);
CREATE INDEX idx_listings_dealer_id    ON listings(dealer_id);
CREATE INDEX idx_listings_make_model   ON listings(make, model);
CREATE TABLE `mobilebg_make_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`search_path` text DEFAULT '/search/avtomobili-dzhipove' NOT NULL,
	`pubtype` text DEFAULT '1,2' NOT NULL,
	`make` text NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`make_id` integer,
	`model_id` integer,
	`make_count` integer,
	`model_count` integer,
	`updated_at` text NOT NULL
);
CREATE UNIQUE INDEX `mobilebg_make_models_scope_make_model_idx` ON `mobilebg_make_models` (`search_path`,`pubtype`,`make`,`model`);
CREATE TABLE `listing_search_result_ignores` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `listing_id` integer NOT NULL,
  `ignored_mobile_id` text NOT NULL,
  `created_at` text,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `listing_search_result_ignores_listing_mobile_idx`
ON `listing_search_result_ignores` (`listing_id`, `ignored_mobile_id`);
CREATE TABLE `listing_search_profiles` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `listing_id` integer NOT NULL,
  `fields_json` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `listing_search_profiles_listing_idx`
ON `listing_search_profiles` (`listing_id`);
CREATE TABLE scrape_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_id INTEGER REFERENCES dealers(id),
  dealer_slug TEXT,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  retry_count INTEGER,
  error TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS "saved_searches" (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer,
	`legacy_profile_listing_id` integer,
	`fields_json` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `saved_searches_legacy_profile_idx` ON `saved_searches` (`legacy_profile_listing_id`);
CREATE INDEX `saved_searches_listing_idx` ON `saved_searches` (`listing_id`, `updated_at`);
CREATE UNIQUE INDEX saved_searches_listing_unique_idx
    ON saved_searches (listing_id)
    WHERE listing_id IS NOT NULL;
CREATE TABLE dealer_template_configs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_id        INTEGER REFERENCES dealers(id) ON DELETE CASCADE,
  base_template_id INTEGER REFERENCES dealer_template_configs(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  config_json      TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "mobilebg_backups" (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `run_id` integer,
  `dealer_id` integer,
  `listing_id` integer,
  `mobile_id` text,
  `source_url` text,
  `source_title` text,
  `make` text,
  `model` text,
  `title` text,
  `price_amount` integer,
  `price_currency` text,
  `vat_included` integer,
  `year` integer,
  `mileage` integer,
  `fuel` text,
  `power` integer,
  `engine` text,
  `color` text,
  `transmission` text,
  `category` text,
  `description` text,
  `phones_json` text,
  `extras_json` text,
  `tech_data_json` text,
  `photo_order_json` text,
  `image_count` integer DEFAULT 0,
  `created_at` text,
  `updated_at` text,
  `ad_status` text,
  `kaparo` integer DEFAULT 0,
  `draft_needs_sync` integer DEFAULT 0,
  `last_mobile_sync_at` text,
  `last_mobile_sync_status` text,
  `last_mobile_sync_error` text,
  `search_checked_at` text,
  `search_original_position` integer,
  `search_price_position` integer,
  `search_first_result_price` real,
  `row_updated_text` text,
  `row_refresh_text` text,
  `row_viewed_at` text,
  `updated_on` text,
  `viewed_since_date` text,
  `views` integer,
  `watching` integer,
  FOREIGN KEY (`run_id`) REFERENCES `mobilebg_crawl_runs`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE instagram_poster_defaults (
        scope_key TEXT PRIMARY KEY,
        prompt_template TEXT NOT NULL,
        variant_prompts_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
CREATE TABLE dealer_enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_id INTEGER NOT NULL REFERENCES dealers(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_dealer_enquiries_dealer
  ON dealer_enquiries(dealer_id, created_at);
CREATE TABLE locales (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1
);
CREATE TABLE translation_keys (
  id TEXT PRIMARY KEY,
  context TEXT,
  description TEXT,
  plural_rules INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE translations (
  id TEXT PRIMARY KEY,
  translation_key_id TEXT NOT NULL,
  locale_code TEXT NOT NULL,
  value TEXT NOT NULL,
  plural_form TEXT,
  interpolation_vars TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(translation_key_id, locale_code, plural_form),
  FOREIGN KEY (translation_key_id) REFERENCES translation_keys(id) ON DELETE CASCADE,
  FOREIGN KEY (locale_code) REFERENCES locales(code) ON DELETE CASCADE
);
CREATE UNIQUE INDEX users_email_unique_idx ON users(email) WHERE email IS NOT NULL;
CREATE TABLE user_page_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  page_key TEXT NOT NULL,
  created_at TEXT,
  UNIQUE(user_id, page_key)
);
CREATE INDEX `listings_active_price_idx`
ON `listings` (`is_active`, `duplicate`, `current_price`);
CREATE INDEX `listings_active_last_edit_idx`
ON `listings` (`is_active`, `duplicate`, `last_edit`);
CREATE INDEX `listings_active_dealer_idx`
ON `listings` (`is_active`, `duplicate`, `dealer_id`);
CREATE INDEX `listings_active_make_model_idx`
ON `listings` (`is_active`, `duplicate`, `make`, `model`);
CREATE INDEX `listings_active_filter_facets_idx`
ON `listings` (`is_active`, `duplicate`, `reg_year`, `body_type`, `fuel`, `ad_status`);
CREATE INDEX `dealers_active_priority_idx`
ON `dealers` (`active`, `own`, `priority`, `name`);
CREATE VIRTUAL TABLE `listings_search_fts`
USING fts5(
  `title`,
  `make`,
  `model`,
  content='listings',
  content_rowid='id',
  tokenize='unicode61'
)
/* listings_search_fts(title,make,model) */;
CREATE TRIGGER `listings_search_fts_after_insert`
AFTER INSERT ON `listings`
BEGIN
  INSERT INTO `listings_search_fts` (`rowid`, `title`, `make`, `model`)
  VALUES (new.`id`, COALESCE(new.`title`, ''), COALESCE(new.`make`, ''), COALESCE(new.`model`, ''));
END;
CREATE TRIGGER `listings_search_fts_after_delete`
AFTER DELETE ON `listings`
BEGIN
  INSERT INTO `listings_search_fts` (`listings_search_fts`, `rowid`, `title`, `make`, `model`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''), COALESCE(old.`make`, ''), COALESCE(old.`model`, ''));
END;
CREATE TRIGGER `listings_search_fts_after_update`
AFTER UPDATE OF `title`, `make`, `model` ON `listings`
BEGIN
  INSERT INTO `listings_search_fts` (`listings_search_fts`, `rowid`, `title`, `make`, `model`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''), COALESCE(old.`make`, ''), COALESCE(old.`model`, ''));
  INSERT INTO `listings_search_fts` (`rowid`, `title`, `make`, `model`)
  VALUES (new.`id`, COALESCE(new.`title`, ''), COALESCE(new.`make`, ''), COALESCE(new.`model`, ''));
END;
CREATE TABLE `listing_extras` (
  `listing_id` integer NOT NULL,
  `extra_label` text NOT NULL,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `listing_extras_unique_idx`
ON `listing_extras` (`listing_id`, `extra_label`);
CREATE INDEX `listing_extras_label_listing_idx`
ON `listing_extras` (`extra_label`, `listing_id`);
CREATE TRIGGER `listing_extras_after_insert`
AFTER INSERT ON `listings`
WHEN new.`extras_json` IS NOT NULL AND json_valid(new.`extras_json`)
BEGIN
  INSERT OR IGNORE INTO `listing_extras` (`listing_id`, `extra_label`)
  SELECT new.`id`, item.`value`
  FROM json_each(new.`extras_json`) item
  WHERE json_type(new.`extras_json`) = 'array'
    AND item.`type` = 'text'
    AND item.`value` != '';

  INSERT OR IGNORE INTO `listing_extras` (`listing_id`, `extra_label`)
  SELECT
    new.`id`,
    CASE
      WHEN item.`type` = 'object' THEN json_extract(item.`value`, '$.label')
      ELSE item.`value`
    END
  FROM json_each(new.`extras_json`) category, json_each(
    CASE WHEN category.`type` = 'array' THEN category.`value` ELSE '[]' END
  ) item
  WHERE json_type(new.`extras_json`) = 'object'
    AND category.`type` = 'array'
    AND (
      (item.`type` = 'text' AND item.`value` != '')
      OR (item.`type` = 'object' AND json_extract(item.`value`, '$.label') IS NOT NULL AND json_extract(item.`value`, '$.label') != '')
    );
END;
CREATE TRIGGER `listing_extras_after_update`
AFTER UPDATE OF `extras_json` ON `listings`
BEGIN
  DELETE FROM `listing_extras` WHERE `listing_id` = new.`id`;

  INSERT OR IGNORE INTO `listing_extras` (`listing_id`, `extra_label`)
  SELECT new.`id`, item.`value`
  FROM json_each(CASE WHEN new.`extras_json` IS NOT NULL AND json_valid(new.`extras_json`) THEN new.`extras_json` ELSE '[]' END) item
  WHERE new.`extras_json` IS NOT NULL
    AND json_valid(new.`extras_json`)
    AND json_type(new.`extras_json`) = 'array'
    AND item.`type` = 'text'
    AND item.`value` != '';

  INSERT OR IGNORE INTO `listing_extras` (`listing_id`, `extra_label`)
  SELECT
    new.`id`,
    CASE
      WHEN item.`type` = 'object' THEN json_extract(item.`value`, '$.label')
      ELSE item.`value`
    END
  FROM json_each(CASE WHEN new.`extras_json` IS NOT NULL AND json_valid(new.`extras_json`) THEN new.`extras_json` ELSE '{}' END) category,
       json_each(CASE WHEN category.`type` = 'array' THEN category.`value` ELSE '[]' END) item
  WHERE new.`extras_json` IS NOT NULL
    AND json_valid(new.`extras_json`)
    AND json_type(new.`extras_json`) = 'object'
    AND category.`type` = 'array'
    AND (
      (item.`type` = 'text' AND item.`value` != '')
      OR (item.`type` = 'object' AND json_extract(item.`value`, '$.label') IS NOT NULL AND json_extract(item.`value`, '$.label') != '')
    );
END;
CREATE TRIGGER `listing_extras_after_delete`
AFTER DELETE ON `listings`
BEGIN
  DELETE FROM `listing_extras` WHERE `listing_id` = old.`id`;
END;
CREATE VIRTUAL TABLE `tasks_search_fts`
USING fts5(
  `title`,
  content='tasks',
  content_rowid='id',
  tokenize='unicode61'
)
/* tasks_search_fts(title) */;
CREATE TRIGGER `tasks_search_fts_after_insert`
AFTER INSERT ON `tasks`
BEGIN
  INSERT INTO `tasks_search_fts` (`rowid`, `title`)
  VALUES (new.`id`, COALESCE(new.`title`, ''));
END;
CREATE TRIGGER `tasks_search_fts_after_delete`
AFTER DELETE ON `tasks`
BEGIN
  INSERT INTO `tasks_search_fts` (`tasks_search_fts`, `rowid`, `title`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''));
END;
CREATE TRIGGER `tasks_search_fts_after_update`
AFTER UPDATE OF `title` ON `tasks`
BEGIN
  INSERT INTO `tasks_search_fts` (`tasks_search_fts`, `rowid`, `title`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''));
  INSERT INTO `tasks_search_fts` (`rowid`, `title`)
  VALUES (new.`id`, COALESCE(new.`title`, ''));
END;
CREATE VIRTUAL TABLE `expenses_search_fts`
USING fts5(
  `title`,
  content='expenses',
  content_rowid='id',
  tokenize='unicode61'
)
/* expenses_search_fts(title) */;
CREATE TRIGGER `expenses_search_fts_after_insert`
AFTER INSERT ON `expenses`
BEGIN
  INSERT INTO `expenses_search_fts` (`rowid`, `title`)
  VALUES (new.`id`, COALESCE(new.`title`, ''));
END;
CREATE TRIGGER `expenses_search_fts_after_delete`
AFTER DELETE ON `expenses`
BEGIN
  INSERT INTO `expenses_search_fts` (`expenses_search_fts`, `rowid`, `title`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''));
END;
CREATE TRIGGER `expenses_search_fts_after_update`
AFTER UPDATE OF `title` ON `expenses`
BEGIN
  INSERT INTO `expenses_search_fts` (`expenses_search_fts`, `rowid`, `title`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''));
  INSERT INTO `expenses_search_fts` (`rowid`, `title`)
  VALUES (new.`id`, COALESCE(new.`title`, ''));
END;
CREATE VIRTUAL TABLE `articles_search_fts`
USING fts5(
  `title`,
  content='articles',
  content_rowid='id',
  tokenize='unicode61'
)
/* articles_search_fts(title) */;
CREATE TRIGGER `articles_search_fts_after_insert`
AFTER INSERT ON `articles`
BEGIN
  INSERT INTO `articles_search_fts` (`rowid`, `title`)
  VALUES (new.`id`, COALESCE(new.`title`, ''));
END;
CREATE TRIGGER `articles_search_fts_after_delete`
AFTER DELETE ON `articles`
BEGIN
  INSERT INTO `articles_search_fts` (`articles_search_fts`, `rowid`, `title`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''));
END;
CREATE TRIGGER `articles_search_fts_after_update`
AFTER UPDATE OF `title` ON `articles`
BEGIN
  INSERT INTO `articles_search_fts` (`articles_search_fts`, `rowid`, `title`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''));
  INSERT INTO `articles_search_fts` (`rowid`, `title`)
  VALUES (new.`id`, COALESCE(new.`title`, ''));
END;
CREATE TABLE `mobilebg_backup_extras` (
  `backup_id` integer NOT NULL,
  `extra_label` text NOT NULL,
  FOREIGN KEY (`backup_id`) REFERENCES `mobilebg_backups`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `mobilebg_backup_extras_unique_idx`
ON `mobilebg_backup_extras` (`backup_id`, `extra_label`);
CREATE INDEX `mobilebg_backup_extras_label_backup_idx`
ON `mobilebg_backup_extras` (`extra_label`, `backup_id`);
CREATE TRIGGER `mobilebg_backup_extras_after_insert`
AFTER INSERT ON `mobilebg_backups`
WHEN new.`extras_json` IS NOT NULL AND json_valid(new.`extras_json`)
BEGIN
  INSERT OR IGNORE INTO `mobilebg_backup_extras` (`backup_id`, `extra_label`)
  SELECT new.`id`, item.`value`
  FROM json_each(new.`extras_json`) item
  WHERE json_type(new.`extras_json`) = 'array'
    AND item.`type` = 'text'
    AND item.`value` != '';

  INSERT OR IGNORE INTO `mobilebg_backup_extras` (`backup_id`, `extra_label`)
  SELECT
    new.`id`,
    CASE
      WHEN item.`type` = 'object' THEN json_extract(item.`value`, '$.label')
      ELSE item.`value`
    END
  FROM json_each(new.`extras_json`) category,
       json_each(CASE WHEN category.`type` = 'array' THEN category.`value` ELSE '[]' END) item
  WHERE json_type(new.`extras_json`) = 'object'
    AND category.`type` = 'array'
    AND (
      (item.`type` = 'text' AND item.`value` != '')
      OR (item.`type` = 'object' AND json_extract(item.`value`, '$.label') IS NOT NULL AND json_extract(item.`value`, '$.label') != '')
    );
END;
CREATE TRIGGER `mobilebg_backup_extras_after_update`
AFTER UPDATE OF `extras_json` ON `mobilebg_backups`
BEGIN
  DELETE FROM `mobilebg_backup_extras` WHERE `backup_id` = new.`id`;

  INSERT OR IGNORE INTO `mobilebg_backup_extras` (`backup_id`, `extra_label`)
  SELECT new.`id`, item.`value`
  FROM json_each(CASE WHEN new.`extras_json` IS NOT NULL AND json_valid(new.`extras_json`) THEN new.`extras_json` ELSE '[]' END) item
  WHERE new.`extras_json` IS NOT NULL
    AND json_valid(new.`extras_json`)
    AND json_type(new.`extras_json`) = 'array'
    AND item.`type` = 'text'
    AND item.`value` != '';

  INSERT OR IGNORE INTO `mobilebg_backup_extras` (`backup_id`, `extra_label`)
  SELECT
    new.`id`,
    CASE
      WHEN item.`type` = 'object' THEN json_extract(item.`value`, '$.label')
      ELSE item.`value`
    END
  FROM json_each(CASE WHEN new.`extras_json` IS NOT NULL AND json_valid(new.`extras_json`) THEN new.`extras_json` ELSE '{}' END) category,
       json_each(CASE WHEN category.`type` = 'array' THEN category.`value` ELSE '[]' END) item
  WHERE new.`extras_json` IS NOT NULL
    AND json_valid(new.`extras_json`)
    AND json_type(new.`extras_json`) = 'object'
    AND category.`type` = 'array'
    AND (
      (item.`type` = 'text' AND item.`value` != '')
      OR (item.`type` = 'object' AND json_extract(item.`value`, '$.label') IS NOT NULL AND json_extract(item.`value`, '$.label') != '')
    );
END;
CREATE TRIGGER `mobilebg_backup_extras_after_delete`
AFTER DELETE ON `mobilebg_backups`
BEGIN
  DELETE FROM `mobilebg_backup_extras` WHERE `backup_id` = old.`id`;
END;
CREATE VIRTUAL TABLE `listing_change_search_fts`
USING fts5(
  `title`,
  `make`,
  `model`,
  `description`,
  content='listings',
  content_rowid='id',
  tokenize='unicode61'
)
/* listing_change_search_fts(title,make,model,description) */;
CREATE TRIGGER `listing_change_search_fts_after_insert`
AFTER INSERT ON `listings`
BEGIN
  INSERT INTO `listing_change_search_fts` (`rowid`, `title`, `make`, `model`, `description`)
  VALUES (new.`id`, COALESCE(new.`title`, ''), COALESCE(new.`make`, ''), COALESCE(new.`model`, ''), COALESCE(new.`description`, ''));
END;
CREATE TRIGGER `listing_change_search_fts_after_delete`
AFTER DELETE ON `listings`
BEGIN
  INSERT INTO `listing_change_search_fts` (`listing_change_search_fts`, `rowid`, `title`, `make`, `model`, `description`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''), COALESCE(old.`make`, ''), COALESCE(old.`model`, ''), COALESCE(old.`description`, ''));
END;
CREATE TRIGGER `listing_change_search_fts_after_update`
AFTER UPDATE OF `title`, `make`, `model`, `description` ON `listings`
BEGIN
  INSERT INTO `listing_change_search_fts` (`listing_change_search_fts`, `rowid`, `title`, `make`, `model`, `description`)
  VALUES ('delete', old.`id`, COALESCE(old.`title`, ''), COALESCE(old.`make`, ''), COALESCE(old.`model`, ''), COALESCE(old.`description`, ''));
  INSERT INTO `listing_change_search_fts` (`rowid`, `title`, `make`, `model`, `description`)
  VALUES (new.`id`, COALESCE(new.`title`, ''), COALESCE(new.`make`, ''), COALESCE(new.`model`, ''), COALESCE(new.`description`, ''));
END;
CREATE INDEX `idx_listing_snapshots_listing_id` ON `listing_snapshots` (`listing_id`);
CREATE INDEX idx_mobilebg_backups_dealer_mobile
  ON mobilebg_backups(dealer_id, mobile_id);
CREATE INDEX idx_mobilebg_backups_listing_id
  ON mobilebg_backups(listing_id);

