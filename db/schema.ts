import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// ─── Existing tables ──────────────────────────────────────────────

export const dealers = sqliteTable('dealers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  mobileUrl: text('mobile_url'),
  own: integer('own').default(0),
  active: integer('active').default(1),
  priority: integer('priority').default(0),
  mobileUser: text('mobile_user'),
  mobilePassword: text('mobile_password'),
  carsUrl: text('cars_url'),
  carsUser: text('cars_user'),
  carsPassword: text('cars_password'),
  createdAt: text('created_at'),
});

export const listings = sqliteTable('listings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mobileId: text('mobile_id').unique(),
  priceChange: integer('price_change'),
  dealerId: integer('dealer_id').references(() => dealers.id),
  url: text('url'),
  title: text('title'),
  make: text('make'),
  model: text('model'),
  regMonth: text('reg_month'),
  regYear: text('reg_year'),
  fuel: text('fuel'),
  color: text('color'),
  power: integer('power'),
  mileage: integer('mileage'),
  description: text('description'),
  adStatus: text('ad_status'),
  kaparo: integer('kaparo'),
  isNew: integer('is_new'),
  lastEdit: text('last_edit'),
  currentPrice: integer('current_price'),
  vat: text('vat'),
  imageCount: integer('image_count'),
  imageMeta: text('image_meta'),
  thumbKeys: text('thumb_keys'),
  fullKeys: text('full_keys'),
  imagesDownloaded: integer('images_downloaded').default(0),
  firstSeenAt: text('first_seen_at'),
  lastSeenAt: text('last_seen_at'),
  isActive: integer('is_active').default(1),
  needsSync: integer('needs_sync').default(0),
});

export const listingSnapshots = sqliteTable('listing_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  listingId: integer('listing_id').references(() => listings.id),
  price: integer('price'),
  vat: text('vat'),
  lastEdit: text('last_edit'),
  adStatus: text('ad_status'),
  kaparo: integer('kaparo'),
  title: text('title'),
  description: text('description'),
  recordedAt: text('recorded_at'),
});

// ─── Users & Auth ─────────────────────────────────────────────────

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'),
  createdAt: text('created_at'),
});

// ─── Labels (shared across tasks, articles, expenses) ─────────────

export const labels = sqliteTable('labels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#6b7280'),
});

// ─── Tasks ────────────────────────────────────────────────────────

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('backlog'),
  priority: text('priority').notNull().default('medium'),
  assigneeId: integer('assignee_id').references(() => users.id),
  createdById: integer('created_by_id').references(() => users.id),
  parentId: integer('parent_id'),
  deadline: text('deadline'),
  isRecurring: integer('is_recurring').default(0),
  recurRule: text('recur_rule'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const taskListings = sqliteTable('task_listings', {
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  listingId: integer('listing_id').notNull().references(() => listings.id),
});

export const taskDeps = sqliteTable('task_deps', {
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  dependsOnId: integer('depends_on_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
});

export const taskLabels = sqliteTable('task_labels', {
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  labelId: integer('label_id').notNull().references(() => labels.id, { onDelete: 'cascade' }),
});

// ─── Comments ─────────────────────────────────────────────────────

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  authorId: integer('author_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

// ─── Time Entries ─────────────────────────────────────────────────

export const timeEntries = sqliteTable('time_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  description: text('description'),
  durationMinutes: integer('duration_minutes').notNull(),
  date: text('date').notNull(),
  createdAt: text('created_at'),
});

// ─── Expenses ─────────────────────────────────────────────────────

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  date: text('date').notNull(),
  category: text('category').notNull(),
  notes: text('notes'),
  createdById: integer('created_by_id').references(() => users.id),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const expenseListings = sqliteTable('expense_listings', {
  expenseId: integer('expense_id').notNull().references(() => expenses.id, { onDelete: 'cascade' }),
  listingId: integer('listing_id').notNull().references(() => listings.id),
});

export const expenseTasks = sqliteTable('expense_tasks', {
  expenseId: integer('expense_id').notNull().references(() => expenses.id, { onDelete: 'cascade' }),
  taskId: integer('task_id').notNull().references(() => tasks.id),
});

export const expenseLabels = sqliteTable('expense_labels', {
  expenseId: integer('expense_id').notNull().references(() => expenses.id, { onDelete: 'cascade' }),
  labelId: integer('label_id').notNull().references(() => labels.id, { onDelete: 'cascade' }),
});

// ─── Uploads (file metadata) ─────────────────────────────────────

export const uploads = sqliteTable('uploads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename').notNull(),
  storedName: text('stored_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  entityType: text('entity_type'),
  entityId: integer('entity_id'),
  uploadedById: integer('uploaded_by_id').references(() => users.id),
  createdAt: text('created_at'),
});

// ─── Knowledge Base ───────────────────────────────────────────────

export const articles = sqliteTable('articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  body: text('body').notNull(),
  authorId: integer('author_id').notNull().references(() => users.id),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const articleLabels = sqliteTable('article_labels', {
  articleId: integer('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  labelId: integer('label_id').notNull().references(() => labels.id, { onDelete: 'cascade' }),
});

export const articleListings = sqliteTable('article_listings', {
  articleId: integer('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  listingId: integer('listing_id').notNull().references(() => listings.id),
});

export const articleDealers = sqliteTable('article_dealers', {
  articleId: integer('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  dealerId: integer('dealer_id').notNull().references(() => dealers.id),
});

export const articleTasks = sqliteTable('article_tasks', {
  articleId: integer('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  taskId: integer('task_id').notNull().references(() => tasks.id),
});

export const articleExpenses = sqliteTable('article_expenses', {
  articleId: integer('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  expenseId: integer('expense_id').notNull().references(() => expenses.id),
});

// ─── Notifications ────────────────────────────────────────────────

export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id').notNull(),
  title: text('title').notNull(),
  readAt: text('read_at'),
  createdAt: text('created_at'),
});

// ─── Activity Log ─────────────────────────────────────────────────

export const activityLog = sqliteTable('activity_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id').notNull(),
  action: text('action').notNull(),
  detail: text('detail'),
  userId: integer('user_id').references(() => users.id),
  createdAt: text('created_at'),
});

// ─── Type exports ─────────────────────────────────────────────────

export type Dealer = typeof dealers.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type ListingSnapshot = typeof listingSnapshots.$inferSelect;
export type User = typeof users.$inferSelect;
export type Label = typeof labels.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Upload = typeof uploads.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ActivityLogEntry = typeof activityLog.$inferSelect;
