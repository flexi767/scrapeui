import { raw } from '@/db/client';

export interface ListingRow {
  id: number;
  mobile_id: string;
  title: string;
  make: string;
  model: string;
  reg_month: string;
  reg_year: string;
  mileage: number;
  fuel: string | null;
  current_price: number;
  price_change: number | null;
  vat: string | null;
  kaparo: number;
  ad_status: string;
  last_edit: string;
  is_new: number;
  thumb_keys: string;
  full_keys: string;
  image_meta: string;
  images_downloaded: number;
  dealer_name: string;
  dealer_slug: string;
  is_active: number;
}

export interface ListingFilters {
  make?: string;
  model?: string;
  dealerSlugs?: string[];
  years?: string[];
  statuses?: string[];
  vatValues?: string[];
  fuels?: string[];
  priceMin?: number | null;
  priceMax?: number | null;
  priceChangeMin?: number | null;
  priceChangeMax?: number | null;
  kaparo?: string;
  sort?: string;
  order?: string;
  search?: string;
  page?: number;
  limit?: number;
}

const VALID_SORT: Record<string, string> = {
  price: 'l.current_price',
  last_edit: 'l.last_edit',
  mileage: 'l.mileage',
  fuel: 'l.fuel',
  dealer: 'd.priority DESC, d.name',
  ad_status: 'l.ad_status',
  kaparo: 'l.kaparo',
  reg_year: 'l.reg_year',
};

export function getListings(filters: ListingFilters = {}) {
  const {
    make = '',
    model = '',
    dealerSlugs = [],
    years = [],
    statuses = [],
    vatValues = [],
    fuels = [],
    priceMin = null,
    priceMax = null,
    priceChangeMin = null,
    priceChangeMax = null,
    kaparo = '',
    sort = 'last_edit',
    order = 'desc',
    search = '',
    page = 1,
    limit = 25,
  } = filters;

  const wheres: string[] = ['l.is_active = 1', 'd.active = 1'];
  const params: (string | number)[] = [];

  if (make) { wheres.push('l.make = ?'); params.push(make); }
  if (model) { wheres.push('l.model = ?'); params.push(model); }

  if (statuses.length > 0) {
    const ph = statuses.map(() => '?').join(',');
    wheres.push(`l.ad_status IN (${ph})`);
    params.push(...statuses);
  }
  if (vatValues.length > 0) {
    const includeNull = vatValues.includes('null');
    const nonNull = vatValues.filter(v => v !== 'null');
    const clauses: string[] = [];
    if (nonNull.length > 0) {
      const ph = nonNull.map(() => '?').join(',');
      clauses.push(`l.vat IN (${ph})`);
      params.push(...nonNull);
    }
    if (includeNull) clauses.push('l.vat IS NULL');
    if (clauses.length > 0) wheres.push(`(${clauses.join(' OR ')})`);
  }
  if (fuels.length > 0) {
    const ph = fuels.map(() => '?').join(',');
    wheres.push(`l.fuel IN (${ph})`);
    params.push(...fuels);
  }
  if (priceMin !== null) { wheres.push('l.current_price >= ?'); params.push(priceMin); }
  if (priceMax !== null) { wheres.push('l.current_price <= ?'); params.push(priceMax); }
  if (priceChangeMin !== null || priceChangeMax !== null) {
    wheres.push('l.price_change IS NOT NULL');
    if (priceChangeMin !== null) { wheres.push('l.price_change >= ?'); params.push(priceChangeMin); }
    if (priceChangeMax !== null) { wheres.push('l.price_change <= ?'); params.push(priceChangeMax); }
  }
  if (kaparo) {
    wheres.push('l.kaparo = ?');
    params.push(kaparo === 'yes' ? 1 : 0);
  }
  if (years.length > 0) {
    const ph = years.map(() => '?').join(',');
    wheres.push(`l.reg_year IN (${ph})`);
    params.push(...years);
  }
  if (search) {
    wheres.push('(l.title LIKE ? OR l.make LIKE ? OR l.model LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (dealerSlugs.length > 0) {
    const ph = dealerSlugs.map(() => '?').join(',');
    wheres.push(`d.slug IN (${ph})`);
    params.push(...dealerSlugs);
  }

  const where = `WHERE ${wheres.join(' AND ')}`;
  const sortCol = VALID_SORT[sort] ?? 'l.last_edit';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;

  const rows = raw.prepare(`
    SELECT
      l.id, l.mobile_id, l.title, l.make, l.model, l.reg_month, l.reg_year, l.mileage, l.fuel,
      l.current_price, l.price_change, l.vat, l.kaparo, l.ad_status, l.last_edit, l.is_new,
      l.thumb_keys, l.full_keys, l.image_meta, l.images_downloaded, l.is_active,
      d.name as dealer_name, d.slug as dealer_slug
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    ${where}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as ListingRow[];

  const { count } = raw.prepare(`
    SELECT COUNT(*) as count
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    ${where}
  `).get(...params) as { count: number };

  return { data: rows, total: count, page, limit };
}

export interface DetailListing {
  id: number;
  mobile_id: string;
  title: string;
  make: string;
  model: string;
  reg_month: string;
  reg_year: string;
  fuel: string;
  color: string;
  power: number;
  mileage: number;
  current_price: number;
  vat: string | null;
  kaparo: number;
  ad_status: string;
  last_edit: string;
  description: string;
  url: string;
  thumb_keys: string;
  full_keys: string;
  image_meta: string;
  images_downloaded: number;
  is_active: number;
  dealer_name: string;
  dealer_slug: string;
  dealer_own: number;
  dealer_url: string;
}

export function getListingByMobileId(mobileId: string): DetailListing | null {
  return raw.prepare(`
    SELECT
      l.*, d.name as dealer_name, d.slug as dealer_slug,
      d.own as dealer_own, d.mobile_url as dealer_url
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    WHERE l.mobile_id = ?
  `).get(mobileId) as DetailListing | null;
}

export interface SnapshotRow {
  id: number;
  price: number;
  vat: string | null;
  last_edit: string | null;
  ad_status: string | null;
  kaparo: number | null;
  title: string | null;
  description: string | null;
  recorded_at: string;
}

export function getSnapshots(listingId: number): SnapshotRow[] {
  return raw.prepare(`
    SELECT id, price, vat, last_edit, ad_status, kaparo, title, description, recorded_at
    FROM listing_snapshots
    WHERE listing_id = ?
    ORDER BY recorded_at ASC
  `).all(listingId) as SnapshotRow[];
}

export interface MakeModel {
  make: string;
  model: string;
}

export function getMakeModels(): Record<string, string[]> {
  const rows = raw.prepare(`
    SELECT DISTINCT make, model FROM listings WHERE is_active = 1 AND make IS NOT NULL ORDER BY make, model
  `).all() as MakeModel[];
  const result: Record<string, string[]> = {};
  for (const r of rows) {
    if (!result[r.make]) result[r.make] = [];
    result[r.make].push(r.model);
  }
  return result;
}

export interface DealerRow {
  id: number;
  slug: string;
  name: string;
  own: number;
  active: number;
  priority: number;
  mobile_url?: string;
  mobile_user?: string | null;
  mobile_password?: string | null;
  cars_user?: string | null;
  cars_password?: string | null;
}

export function getAllDealers(): DealerRow[] {
  return raw.prepare('SELECT id, slug, name, own, active, priority, mobile_url, mobile_user, mobile_password, cars_user, cars_password FROM dealers ORDER BY priority DESC, name').all() as DealerRow[];
}

export function getDistinctYears(): string[] {
  const rows = raw.prepare(
    `SELECT DISTINCT reg_year FROM listings WHERE is_active = 1 AND reg_year IS NOT NULL ORDER BY reg_year DESC`
  ).all() as { reg_year: string }[];
  return rows.map(r => r.reg_year);
}

export function getPriceRange(): { min: number; max: number } | null {
  const row = raw.prepare(
    `SELECT MIN(current_price) as min, MAX(current_price) as max FROM listings WHERE is_active = 1 AND current_price IS NOT NULL`
  ).get() as { min: number | null; max: number | null };
  if (row.min == null || row.max == null) return null;
  return { min: row.min, max: row.max };
}

export function getPriceChangeRange(): { min: number; max: number } | null {
  const row = raw.prepare(
    `SELECT MIN(price_change) as min, MAX(price_change) as max FROM listings WHERE price_change IS NOT NULL`
  ).get() as { min: number | null; max: number | null };
  if (row.min == null || row.max == null) return null;
  return { min: row.min, max: row.max };
}

export function getDistinctFuels(): string[] {
  const rows = raw.prepare(
    `SELECT DISTINCT fuel FROM listings WHERE is_active = 1 AND fuel IS NOT NULL ORDER BY fuel`
  ).all() as { fuel: string }[];
  return rows.map(r => r.fuel);
}

// ─── Users ────────────────────────────────────────────────────────

export interface UserRow {
  id: number;
  username: string;
  name: string;
  role: string;
}

export function getAllUsers(): UserRow[] {
  return raw.prepare('SELECT id, username, name, role FROM users ORDER BY name').all() as UserRow[];
}

// ─── Labels ───────────────────────────────────────────────────────

export interface LabelRow {
  id: number;
  name: string;
  color: string;
}

export function getAllLabels(): LabelRow[] {
  return raw.prepare('SELECT id, name, color FROM labels ORDER BY name').all() as LabelRow[];
}

// ─── Listing Summaries (for pickers) ─────────────────────────────

export interface ListingSummary {
  id: number;
  mobile_id: string;
  title: string;
  make: string;
  model: string;
  reg_year: string;
  current_price: number;
}

export function getListingSummaries(): ListingSummary[] {
  return raw.prepare(`
    SELECT id, mobile_id, title, make, model, reg_year, current_price
    FROM listings WHERE is_active = 1 ORDER BY make, model, reg_year
  `).all() as ListingSummary[];
}

// ─── Tasks ────────────────────────────────────────────────────────

export interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: number | null;
  created_by_id: number | null;
  parent_id: number | null;
  deadline: string | null;
  is_recurring: number;
  recur_rule: string | null;
  created_at: string;
  updated_at: string;
  assignee_name: string | null;
  creator_name: string | null;
}

export interface TaskFilters {
  status?: string;
  priority?: string;
  assigneeId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export function getTasks(filters: TaskFilters = {}) {
  const { status, priority, assigneeId, search, page = 1, limit = 50 } = filters;
  const wheres: string[] = [];
  const params: (string | number)[] = [];

  if (status) { wheres.push('t.status = ?'); params.push(status); }
  if (priority) { wheres.push('t.priority = ?'); params.push(priority); }
  if (assigneeId) { wheres.push('t.assignee_id = ?'); params.push(assigneeId); }
  if (search) {
    wheres.push('(t.title LIKE ?)');
    params.push(`%${search}%`);
  }

  const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const rows = raw.prepare(`
    SELECT t.*,
      a.name as assignee_name,
      c.name as creator_name
    FROM tasks t
    LEFT JOIN users a ON a.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by_id
    ${where}
    ORDER BY
      CASE t.status WHEN 'in_progress' THEN 0 WHEN 'backlog' THEN 1 WHEN 'done' THEN 2 WHEN 'cancelled' THEN 3 END,
      CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
      t.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as TaskRow[];

  const { count } = raw.prepare(`
    SELECT COUNT(*) as count FROM tasks t ${where}
  `).get(...params) as { count: number };

  return { data: rows, total: count, page, limit };
}

export function getTaskById(id: number) {
  const task = raw.prepare(`
    SELECT t.*,
      a.name as assignee_name,
      c.name as creator_name
    FROM tasks t
    LEFT JOIN users a ON a.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by_id
    WHERE t.id = ?
  `).get(id) as TaskRow | undefined;

  if (!task) return null;

  const listings = raw.prepare(`
    SELECT l.id, l.mobile_id, l.title, l.make, l.model, l.reg_year, l.current_price
    FROM task_listings tl
    JOIN listings l ON l.id = tl.listing_id
    WHERE tl.task_id = ?
  `).all(id) as ListingSummary[];

  const labels = raw.prepare(`
    SELECT lb.id, lb.name, lb.color
    FROM task_labels tl
    JOIN labels lb ON lb.id = tl.label_id
    WHERE tl.task_id = ?
  `).all(id) as LabelRow[];

  const subtasks = raw.prepare(`
    SELECT t.id, t.title, t.status, t.priority
    FROM tasks t WHERE t.parent_id = ?
    ORDER BY t.created_at
  `).all(id) as { id: number; title: string; status: string; priority: string }[];

  const deps = raw.prepare(`
    SELECT t.id, t.title, t.status
    FROM task_deps td
    JOIN tasks t ON t.id = td.depends_on_id
    WHERE td.task_id = ?
  `).all(id) as { id: number; title: string; status: string }[];

  return { ...task, listings, labels, subtasks, deps };
}

export function getTaskLabels(taskId: number): LabelRow[] {
  return raw.prepare(`
    SELECT lb.id, lb.name, lb.color
    FROM task_labels tl
    JOIN labels lb ON lb.id = tl.label_id
    WHERE tl.task_id = ?
  `).all(taskId) as LabelRow[];
}

export function getTaskListings(taskId: number): ListingSummary[] {
  return raw.prepare(`
    SELECT l.id, l.mobile_id, l.title, l.make, l.model, l.reg_year, l.current_price
    FROM task_listings tl
    JOIN listings l ON l.id = tl.listing_id
    WHERE tl.task_id = ?
  `).all(taskId) as ListingSummary[];
}

// ─── Comments ─────────────────────────────────────────────────────

export interface CommentRow {
  id: number;
  task_id: number;
  author_id: number;
  body: string;
  created_at: string;
  updated_at: string;
  author_name: string;
}

export function getTaskComments(taskId: number): CommentRow[] {
  return raw.prepare(`
    SELECT c.*, u.name as author_name
    FROM comments c
    JOIN users u ON u.id = c.author_id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(taskId) as CommentRow[];
}

// ─── Time Entries ─────────────────────────────────────────────────

export interface TimeEntryRow {
  id: number;
  task_id: number;
  user_id: number;
  description: string | null;
  duration_minutes: number;
  date: string;
  created_at: string;
  user_name: string;
}

export function getTaskTimeEntries(taskId: number): TimeEntryRow[] {
  return raw.prepare(`
    SELECT te.*, u.name as user_name
    FROM time_entries te
    JOIN users u ON u.id = te.user_id
    WHERE te.task_id = ?
    ORDER BY te.date DESC, te.created_at DESC
  `).all(taskId) as TimeEntryRow[];
}

// ─── Activity Log ─────────────────────────────────────────────────

export interface ActivityRow {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  detail: string | null;
  user_id: number | null;
  created_at: string;
  user_name: string | null;
}

export function getActivityLog(entityType: string, entityId: number): ActivityRow[] {
  return raw.prepare(`
    SELECT al.*, u.name as user_name
    FROM activity_log al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE al.entity_type = ? AND al.entity_id = ?
    ORDER BY al.created_at DESC
    LIMIT 100
  `).all(entityType, entityId) as ActivityRow[];
}

// ─── Expenses ─────────────────────────────────────────────────────

export interface ExpenseRow {
  id: number;
  title: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  notes: string | null;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
  creator_name: string | null;
}

export interface ExpenseFilters {
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function getExpenses(filters: ExpenseFilters = {}) {
  const { category, dateFrom, dateTo, search, page = 1, limit = 50 } = filters;
  const wheres: string[] = [];
  const params: (string | number)[] = [];

  if (category) { wheres.push('e.category = ?'); params.push(category); }
  if (dateFrom) { wheres.push('e.date >= ?'); params.push(dateFrom); }
  if (dateTo) { wheres.push('e.date <= ?'); params.push(dateTo); }
  if (search) { wheres.push('e.title LIKE ?'); params.push(`%${search}%`); }

  const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const rows = raw.prepare(`
    SELECT e.*, u.name as creator_name
    FROM expenses e
    LEFT JOIN users u ON u.id = e.created_by_id
    ${where}
    ORDER BY e.date DESC, e.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as ExpenseRow[];

  const { count } = raw.prepare(`
    SELECT COUNT(*) as count FROM expenses e ${where}
  `).get(...params) as { count: number };

  const { total_amount } = raw.prepare(`
    SELECT COALESCE(SUM(e.amount), 0) as total_amount FROM expenses e ${where}
  `).get(...params) as { total_amount: number };

  return { data: rows, total: count, totalAmount: total_amount, page, limit };
}

export function getExpenseById(id: number) {
  const expense = raw.prepare(`
    SELECT e.*, u.name as creator_name
    FROM expenses e
    LEFT JOIN users u ON u.id = e.created_by_id
    WHERE e.id = ?
  `).get(id) as ExpenseRow | undefined;

  if (!expense) return null;

  const listings = raw.prepare(`
    SELECT l.id, l.mobile_id, l.title, l.make, l.model, l.reg_year, l.current_price
    FROM expense_listings el
    JOIN listings l ON l.id = el.listing_id
    WHERE el.expense_id = ?
  `).all(id) as ListingSummary[];

  const tasks = raw.prepare(`
    SELECT t.id, t.title, t.status
    FROM expense_tasks et
    JOIN tasks t ON t.id = et.task_id
    WHERE et.expense_id = ?
  `).all(id) as { id: number; title: string; status: string }[];

  const labels = raw.prepare(`
    SELECT lb.id, lb.name, lb.color
    FROM expense_labels el
    JOIN labels lb ON lb.id = el.label_id
    WHERE el.expense_id = ?
  `).all(id) as LabelRow[];

  const uploads = raw.prepare(`
    SELECT * FROM uploads
    WHERE entity_type = 'expense' AND entity_id = ?
    ORDER BY created_at DESC
  `).all(id);

  return { ...expense, listings, tasks, labels, uploads };
}

// ─── Articles (Knowledge Base) ────────────────────────────────────

export interface ArticleRow {
  id: number;
  title: string;
  slug: string;
  body: string;
  author_id: number;
  created_at: string;
  updated_at: string;
  author_name: string;
}

export interface ArticleFilters {
  search?: string;
  labelId?: number;
  page?: number;
  limit?: number;
}

export function getArticles(filters: ArticleFilters = {}) {
  const { search, labelId, page = 1, limit = 50 } = filters;
  const wheres: string[] = [];
  const params: (string | number)[] = [];

  if (search) { wheres.push('a.title LIKE ?'); params.push(`%${search}%`); }
  if (labelId) {
    wheres.push('EXISTS (SELECT 1 FROM article_labels al WHERE al.article_id = a.id AND al.label_id = ?)');
    params.push(labelId);
  }

  const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const rows = raw.prepare(`
    SELECT a.*, u.name as author_name
    FROM articles a
    LEFT JOIN users u ON u.id = a.author_id
    ${where}
    ORDER BY a.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as ArticleRow[];

  const { count } = raw.prepare(`
    SELECT COUNT(*) as count FROM articles a ${where}
  `).get(...params) as { count: number };

  return { data: rows, total: count, page, limit };
}

export function getArticleBySlug(slug: string) {
  const article = raw.prepare(`
    SELECT a.*, u.name as author_name
    FROM articles a
    LEFT JOIN users u ON u.id = a.author_id
    WHERE a.slug = ?
  `).get(slug) as ArticleRow | undefined;

  if (!article) return null;

  const labels = raw.prepare(`
    SELECT lb.id, lb.name, lb.color
    FROM article_labels al
    JOIN labels lb ON lb.id = al.label_id
    WHERE al.article_id = ?
  `).all(article.id) as LabelRow[];

  const listings = raw.prepare(`
    SELECT l.id, l.mobile_id, l.title, l.make, l.model, l.reg_year, l.current_price
    FROM article_listings al
    JOIN listings l ON l.id = al.listing_id
    WHERE al.article_id = ?
  `).all(article.id) as ListingSummary[];

  const uploads = raw.prepare(`
    SELECT * FROM uploads
    WHERE entity_type = 'article' AND entity_id = ?
    ORDER BY created_at DESC
  `).all(article.id);

  return { ...article, labels, listings, uploads };
}

// ─── Tasks by Listing ─────────────────────────────────────────────

export function getTasksByListing(listingId: number) {
  return raw.prepare(`
    SELECT t.id, t.title, t.status, t.priority, t.deadline, t.created_at,
      a.name as assignee_name
    FROM task_listings tl
    JOIN tasks t ON t.id = tl.task_id
    LEFT JOIN users a ON a.id = t.assignee_id
    WHERE tl.listing_id = ?
    ORDER BY
      CASE t.status WHEN 'in_progress' THEN 0 WHEN 'backlog' THEN 1 WHEN 'done' THEN 2 WHEN 'cancelled' THEN 3 END,
      t.created_at DESC
  `).all(listingId);
}

// ─── Expenses by Listing ──────────────────────────────────────────

export function getExpensesByListing(listingId: number) {
  return raw.prepare(`
    SELECT e.id, e.title, e.amount, e.currency, e.date, e.category
    FROM expense_listings el
    JOIN expenses e ON e.id = el.expense_id
    WHERE el.listing_id = ?
    ORDER BY e.date DESC
  `).all(listingId);
}
