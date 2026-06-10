import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Existing tables ──────────────────────────────────────────────

export const dealers = sqliteTable("dealers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  mobileUrl: text("mobile_url"),
  own: integer("own").default(0),
  active: integer("active").default(1),
  priority: integer("priority").default(0),
  mobileUser: text("mobile_user"),
  mobilePassword: text("mobile_password"),
  carsUrl: text("cars_url"),
  carsUser: text("cars_user"),
  carsPassword: text("cars_password"),
  createdAt: text("created_at"),
  publicDomain: text("public_domain"),
  template: text("template").notNull().default("bold"),
  publicEnabled: integer("public_enabled").notNull().default(0),
  activeTemplateConfigId: integer("active_template_config_id"),
  facebookUser: text("facebook_user"),
  facebookPassword: text("facebook_password"),
  instagramUser: text("instagram_user"),
  instagramPassword: text("instagram_password"),
  tiktokUser: text("tiktok_user"),
  tiktokPassword: text("tiktok_password"),
});

export const listings = sqliteTable(
  "listings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mobileId: text("mobile_id").unique(),
    priceChange: integer("price_change"),
    dealerId: integer("dealer_id").references(() => dealers.id),
    url: text("url"),
    title: text("title"),
    make: text("make"),
    model: text("model"),
    mobileMakeId: integer("mobile_make_id"),
    mobileModelId: integer("mobile_model_id"),
    carsMakeId: integer("cars_make_id"),
    carsModelId: integer("cars_model_id"),
    regMonth: text("reg_month"),
    regYear: text("reg_year"),
    fuel: text("fuel"),
    bodyType: text("body_type"),
    transmission: text("transmission"),
    color: text("color"),
    vin: text("vin"),
    euronorm: integer("euronorm"),
    power: integer("power"),
    mileage: integer("mileage"),
    description: text("description"),
    extrasJson: text("extras_json"),
    adStatus: text("ad_status"),
    kaparo: integer("kaparo"),
    isNew: integer("is_new"),
    lastEdit: text("last_edit"),
    carsbgTitle: text("carsbg_title"),
    carsbgCreatedDate: text("carsbg_created_date"),
    carsbgEditedDate: text("carsbg_edited_date"),
    carsPrice: integer("cars_price"),
    carsTotalViews: integer("cars_total_views"),
    carsImages: text("cars_images"),
    views: integer("views"),
    currentPrice: integer("current_price"),
    vat: text("vat"),
    imageCount: integer("image_count"),
    imageMeta: text("image_meta"),
    thumbKeys: text("thumb_keys"),
    fullKeys: text("full_keys"),
    imagesDownloaded: integer("images_downloaded").default(0),
    thumbSaved: integer("thumb_saved").default(0),
    firstSeenAt: text("first_seen_at"),
    lastSeenAt: text("last_seen_at"),
    isActive: integer("is_active").default(1),
    deletedAt: text("deleted_at"),
    carsId: text("cars_id"), // cars.bg offer ID after sync
    source: text("source").default("m"), // 'm' = mobile.bg, 'c' = cars.bg
    duplicate: integer("duplicate").default(0), // 1 = duplicate of listing from other source
  },
  (table) => ({
    dealerIdIdx: index("idx_listings_dealer_id").on(table.dealerId),
    makeModelIdx: index("idx_listings_make_model").on(table.make, table.model),
  }),
);

export const listingSnapshots = sqliteTable(
  "listing_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listingId: integer("listing_id").references(() => listings.id),
    price: integer("price"),
    vat: text("vat"),
    lastEdit: text("last_edit"),
    views: integer("views"),
    adStatus: text("ad_status"),
    kaparo: integer("kaparo"),
    title: text("title"),
    description: text("description"),
    recordedAt: text("recorded_at"),
  },
  (table) => ({
    listingIdIdx: index("idx_listing_snapshots_listing_id").on(table.listingId),
  }),
);

export const listingExtras = sqliteTable(
  "listing_extras",
  {
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    extraLabel: text("extra_label").notNull(),
  },
  (table) => ({
    uniqueListingExtra: uniqueIndex("listing_extras_unique_idx").on(table.listingId, table.extraLabel),
    labelListingIdx: index("listing_extras_label_listing_idx").on(table.extraLabel, table.listingId),
  }),
);

// ─── Users & Auth ─────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: text("created_at"),
  dealerId: integer("dealer_id").references(() => dealers.id),
});

export const dealerTemplateConfigs = sqliteTable("dealer_template_configs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dealerId: integer("dealer_id").references(() => dealers.id),
  baseTemplateId: integer("base_template_id"),
  name: text("name").notNull(),
  configJson: text("config_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const userPagePermissions = sqliteTable(
  "user_page_permissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    pageKey: text("page_key").notNull(),
    createdAt: text("created_at"),
  },
  (table) => ({
    uniqueUserPage: unique().on(table.userId, table.pageKey),
  }),
);

export const instagramPosterDefaults = sqliteTable("instagram_poster_defaults", {
  scopeKey: text("scope_key").primaryKey(),
  promptTemplate: text("prompt_template").notNull(),
  variantPromptsJson: text("variant_prompts_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── Labels (shared across tasks, articles, expenses) ─────────────

export const labels = sqliteTable("labels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#6b7280"),
});

// ─── Tasks ────────────────────────────────────────────────────────

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("backlog"),
  priority: text("priority").notNull().default("medium"),
  assigneeId: integer("assignee_id").references(() => users.id),
  createdById: integer("created_by_id").references(() => users.id),
  parentId: integer("parent_id"),
  deadline: text("deadline"),
  isRecurring: integer("is_recurring").default(0),
  recurRule: text("recur_rule"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const taskListings = sqliteTable("task_listings", {
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  listingId: integer("listing_id")
    .notNull()
    .references(() => listings.id),
});

export const taskDeps = sqliteTable("task_deps", {
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  dependsOnId: integer("depends_on_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
});

export const taskLabels = sqliteTable("task_labels", {
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  labelId: integer("label_id")
    .notNull()
    .references(() => labels.id, { onDelete: "cascade" }),
});

// ─── Comments ─────────────────────────────────────────────────────

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

// ─── Time Entries ─────────────────────────────────────────────────

export const timeEntries = sqliteTable("time_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  description: text("description"),
  durationMinutes: integer("duration_minutes").notNull(),
  date: text("date").notNull(),
  createdAt: text("created_at"),
});

// ─── Expenses ─────────────────────────────────────────────────────

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("EUR"),
  date: text("date").notNull(),
  category: text("category").notNull(),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const expenseListings = sqliteTable("expense_listings", {
  expenseId: integer("expense_id")
    .notNull()
    .references(() => expenses.id, { onDelete: "cascade" }),
  listingId: integer("listing_id")
    .notNull()
    .references(() => listings.id),
});

export const expenseTasks = sqliteTable("expense_tasks", {
  expenseId: integer("expense_id")
    .notNull()
    .references(() => expenses.id, { onDelete: "cascade" }),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id),
});

export const expenseLabels = sqliteTable("expense_labels", {
  expenseId: integer("expense_id")
    .notNull()
    .references(() => expenses.id, { onDelete: "cascade" }),
  labelId: integer("label_id")
    .notNull()
    .references(() => labels.id, { onDelete: "cascade" }),
});

// ─── Uploads (file metadata) ─────────────────────────────────────

export const uploads = sqliteTable("uploads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filename: text("filename").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  uploadedById: integer("uploaded_by_id").references(() => users.id),
  createdAt: text("created_at"),
});

// ─── Knowledge Base ───────────────────────────────────────────────

export const articles = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  body: text("body").notNull(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const articleLabels = sqliteTable("article_labels", {
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  labelId: integer("label_id")
    .notNull()
    .references(() => labels.id, { onDelete: "cascade" }),
});

export const articleListings = sqliteTable("article_listings", {
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  listingId: integer("listing_id")
    .notNull()
    .references(() => listings.id),
});

export const articleDealers = sqliteTable("article_dealers", {
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  dealerId: integer("dealer_id")
    .notNull()
    .references(() => dealers.id),
});

export const articleTasks = sqliteTable("article_tasks", {
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id),
});

export const articleExpenses = sqliteTable("article_expenses", {
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  expenseId: integer("expense_id")
    .notNull()
    .references(() => expenses.id),
});

// ─── Notifications ────────────────────────────────────────────────

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  title: text("title").notNull(),
  readAt: text("read_at"),
  createdAt: text("created_at"),
});

export const dealerEnquiries = sqliteTable("dealer_enquiries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dealerId: integer("dealer_id")
    .notNull()
    .references(() => dealers.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  readAt: text("read_at"),
  createdAt: text("created_at"),
});

// ─── Activity Log ─────────────────────────────────────────────────

export const activityLog = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail"),
  userId: integer("user_id").references(() => users.id),
  createdAt: text("created_at"),
});

// ─── Scrape Failures ──────────────────────────────────────────────

export const scrapeFailures = sqliteTable("scrape_failures", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dealerId: integer("dealer_id").references(() => dealers.id),
  dealerSlug: text("dealer_slug"),
  url: text("url").notNull(),
  source: text("source").notNull(), // 'mobile.bg' | 'cars.bg'
  retryCount: integer("retry_count"),
  error: text("error"),
  createdAt: text("created_at"),
});

// ─── Mobile.bg Backup / Edit / Repost Artifacts ──────────────────

export const mobileBgCrawlRuns = sqliteTable("mobilebg_crawl_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dealerId: integer("dealer_id").references(() => dealers.id),
  status: text("status").notNull().default("pending"),
  sourceUrl: text("source_url"),
  listingsCount: integer("listings_count").default(0),
  imagesCount: integer("images_count").default(0),
  imagesDownloaded: integer("images_downloaded").notNull().default(0),
  imagesFailed: integer("images_failed").notNull().default(0),
  notes: text("notes"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const mobileBgBackups = sqliteTable("mobilebg_backups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id").references(() => mobileBgCrawlRuns.id),
  dealerId: integer("dealer_id").references(() => dealers.id),
  listingId: integer("listing_id").references(() => listings.id),
  mobileId: text("mobile_id"),
  sourceUrl: text("source_url"),
  sourceTitle: text("source_title"),
  rowRefreshText: text("row_refresh_text"),
  views: integer("views"),
  viewedSinceDate: text("viewed_since_date"),
  watching: integer("watching"),
  make: text("make"),
  model: text("model"),
  title: text("title"),
  priceAmount: integer("price_amount"),
  priceCurrency: text("price_currency"),
  vatIncluded: text("vat_included"),
  year: integer("year"),
  mileage: integer("mileage"),
  fuel: text("fuel"),
  power: integer("power"),
  engine: text("engine"),
  color: text("color"),
  transmission: text("transmission"),
  category: text("category"),
  description: text("description"),
  adStatus: text("ad_status"),
  kaparo: integer("kaparo").default(0),
  draftNeedsSync: integer("draft_needs_sync").default(0),
  lastMobileSyncStatus: text("last_mobile_sync_status"),
  lastMobileSyncError: text("last_mobile_sync_error"),
  lastMobileSyncAt: text("last_mobile_sync_at"),
  phonesJson: text("phones_json"),
  extrasJson: text("extras_json"),
  techDataJson: text("tech_data_json"),
  photoOrderJson: text("photo_order_json"),
  imageCount: integer("image_count").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const mobileBgBackupImages = sqliteTable("mobilebg_backup_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  backupId: integer("backup_id")
    .notNull()
    .references(() => mobileBgBackups.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  filename: text("filename").notNull(),
  sourceUrl: text("source_url"),
  localPath: text("local_path").notNull(),
  createdAt: text("created_at"),
});

export const mobileBgEditFormSnapshots = sqliteTable(
  "mobilebg_edit_form_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    dealerId: integer("dealer_id").references(() => dealers.id),
    listingId: integer("listing_id").references(() => listings.id),
    backupId: integer("backup_id").references(() => mobileBgBackups.id),
    mobileId: text("mobile_id"),
    sourceUrl: text("source_url"),
    listingToken: text("listing_token"),
    rowTitle: text("row_title"),
    rowPriceText: text("row_price_text"),
    rowRefreshText: text("row_refresh_text"),
    views: integer("views"),
    viewedSinceDate: text("viewed_since_date"),
    watching: integer("watching"),
    formUrl: text("form_url"),
    formsJson: text("forms_json"),
    fieldsJson: text("fields_json"),
    checkedBoxesJson: text("checked_boxes_json"),
    checkedRadiosJson: text("checked_radios_json"),
    hiddenJson: text("hidden_json"),
    screenshotPath: text("screenshot_path"),
    createdAt: text("created_at"),
  },
);

export const mobileBgRepostJobs = sqliteTable("mobilebg_repost_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dealerId: integer("dealer_id").references(() => dealers.id),
  backupId: integer("backup_id").references(() => mobileBgBackups.id),
  listingId: integer("listing_id").references(() => listings.id),
  sourceMobileId: text("source_mobile_id"),
  targetMobileId: text("target_mobile_id"),
  status: text("status").notNull().default("pending"),
  message: text("message"),
  previewScreenshotPath: text("preview_screenshot_path"),
  debugDir: text("debug_dir"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  createdAt: text("created_at"),
});

export const mobileBgMakeModels = sqliteTable(
  "mobilebg_make_models",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    searchPath: text("search_path")
      .notNull()
      .default("/search/avtomobili-dzhipove"),
    pubtype: text("pubtype").notNull().default("1,2"),
    make: text("make").notNull(),
    model: text("model").notNull().default(""),
    makeId: integer("make_id"),
    modelId: integer("model_id"),
    makeCount: integer("make_count"),
    modelCount: integer("model_count"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    uniqueMakeModel: uniqueIndex(
      "mobilebg_make_models_scope_make_model_idx",
    ).on(table.searchPath, table.pubtype, table.make, table.model),
  }),
);

export const listingSearchResultIgnores = sqliteTable(
  "listing_search_result_ignores",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    ignoredMobileId: text("ignored_mobile_id").notNull(),
    createdAt: text("created_at"),
  },
  (table) => ({
    uniqueListingMobile: uniqueIndex(
      "listing_search_result_ignores_listing_mobile_idx",
    ).on(table.listingId, table.ignoredMobileId),
  }),
);

// ─── Translations / Localization ──────────────────────────────────

export const locales = sqliteTable("locales", {
  code: text("code").primaryKey(), // 'bg', 'en', 'de', 'ru'
  name: text("name").notNull(), // 'Bulgarian', 'English', etc.
  isActive: integer("is_active").default(1), // 1 = enabled, 0 = disabled
});

export const translationKeys = sqliteTable("translation_keys", {
  id: text("id").primaryKey(), // 'nav.listings', 'error.not_found', etc.
  context: text("context"), // 'ui', 'content', 'error', 'form'
  description: text("description"), // Help text for translators
  pluralRules: integer("plural_rules").default(0), // 1 if has plural variants
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const translations = sqliteTable(
  "translations",
  {
    id: text("id").primaryKey(), // UUID
    translationKeyId: text("translation_key_id")
      .notNull()
      .references(() => translationKeys.id, { onDelete: "cascade" }),
    localeCode: text("locale_code")
      .notNull()
      .references(() => locales.code, { onDelete: "cascade" }),
    value: text("value").notNull(), // The translated string
    pluralForm: text("plural_form"), // 'zero', 'one', 'few', 'many', 'other', or null
    interpolationVars: text("interpolation_vars"), // JSON metadata
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    uniqueKeyLocaleForm: unique().on(
      table.translationKeyId,
      table.localeCode,
      table.pluralForm,
    ),
  }),
);

// ─── Type exports ─────────────────────────────────────────────────

export type Dealer = typeof dealers.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type ListingSnapshot = typeof listingSnapshots.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserPagePermission = typeof userPagePermissions.$inferSelect;
export type Label = typeof labels.$inferSelect;
export type MobileBgCrawlRun = typeof mobileBgCrawlRuns.$inferSelect;
export type MobileBgBackup = typeof mobileBgBackups.$inferSelect;
export type MobileBgBackupImage = typeof mobileBgBackupImages.$inferSelect;
export type MobileBgEditFormSnapshot =
  typeof mobileBgEditFormSnapshots.$inferSelect;
export type MobileBgRepostJob = typeof mobileBgRepostJobs.$inferSelect;
export type MobileBgMakeModel = typeof mobileBgMakeModels.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Upload = typeof uploads.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ActivityLogEntry = typeof activityLog.$inferSelect;
export type Locale = typeof locales.$inferSelect;
export type TranslationKey = typeof translationKeys.$inferSelect;
export type Translation = typeof translations.$inferSelect;
