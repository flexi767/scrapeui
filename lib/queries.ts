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

export interface OwnListingRow extends ListingRow {
  needs_sync: number;
}

export interface MakeModelMappingRow {
  make: string | null;
  model: string | null;
  mobile_make_id: number | null;
  mobile_model_id: number | null;
  cars_make_id: number | null;
  cars_model_id: number | null;
  listing_count: number;
  sample_mobile_id: string | null;
  sample_title: string | null;
  dealer_names: string | null;
  latest_last_edit: string | null;
}

export interface MobileBgDashboardSummary {
  runs: number;
  backups: number;
  images: number;
  editForms: number;
  repostJobs: number;
}

export interface MobileBgBackupRunRow {
  id: number;
  status: string;
  source_url: string | null;
  listings_count: number;
  images_count: number;
  notes: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  dealer_name: string | null;
  dealer_slug: string | null;
}

export interface MobileBgBackupListRow {
  id: number;
  run_id: number | null;
  listing_id: number | null;
  mobile_id: string | null;
  source_url: string | null;
  source_title: string | null;
  make: string | null;
  model: string | null;
  title: string | null;
  price_amount: number | null;
  price_currency: string | null;
  image_count: number;
  created_at: string | null;
  updated_at: string | null;
  dealer_name: string | null;
  dealer_slug: string | null;
}

export interface MobileBgBackupImageRow {
  id: number;
  backup_id: number;
  sort_order: number;
  filename: string;
  source_url: string | null;
  local_path: string;
  created_at: string | null;
}

export interface MobileBgBackupDetailRow extends MobileBgBackupListRow {
  vat_included: number | null;
  year: number | null;
  mileage: number | null;
  fuel: string | null;
  power: number | null;
  engine: string | null;
  color: string | null;
  transmission: string | null;
  category: string | null;
  description: string | null;
  phones_json: string | null;
  extras_json: string | null;
  tech_data_json: string | null;
  photo_order_json: string | null;
}

export interface MobileBgEditFormRow {
  id: number;
  backup_id: number | null;
  listing_id: number | null;
  mobile_id: string | null;
  source_url: string | null;
  listing_token: string | null;
  row_title: string | null;
  row_price_text: string | null;
  form_url: string | null;
  screenshot_path: string | null;
  created_at: string | null;
  dealer_name: string | null;
  dealer_slug: string | null;
}

export interface MobileBgEditFormDetailRow extends MobileBgEditFormRow {
  forms_json: string | null;
  fields_json: string | null;
  checked_boxes_json: string | null;
  checked_radios_json: string | null;
  hidden_json: string | null;
}

export interface MobileBgRepostJobRow {
  id: number;
  backup_id: number | null;
  listing_id: number | null;
  source_mobile_id: string | null;
  target_mobile_id: string | null;
  status: string;
  message: string | null;
  preview_screenshot_path: string | null;
  debug_dir: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
  dealer_name: string | null;
  dealer_slug: string | null;
  backup_title: string | null;
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

export function getOwnListings(filters: ListingFilters = {}) {
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

  const wheres: string[] = ['l.is_active = 1', 'd.active = 1', 'd.own = 1'];
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
      l.thumb_keys, l.full_keys, l.image_meta, l.images_downloaded, l.is_active, l.needs_sync,
      d.name as dealer_name, d.slug as dealer_slug
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    ${where}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as OwnListingRow[];

  const { count } = raw.prepare(`
    SELECT COUNT(*) as count
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    ${where}
  `).get(...params) as { count: number };

  return { data: rows, total: count, page, limit };
}

export function getOwnListingByMobileId(mobileId: string): OwnListingRow | null {
  return raw.prepare(`
    SELECT
      l.id, l.mobile_id, l.title, l.make, l.model, l.reg_month, l.reg_year, l.mileage, l.fuel,
      l.current_price, l.price_change, l.vat, l.kaparo, l.ad_status, l.last_edit, l.is_new,
      l.thumb_keys, l.full_keys, l.image_meta, l.images_downloaded, l.is_active, l.needs_sync,
      d.name as dealer_name, d.slug as dealer_slug
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    WHERE l.mobile_id = ? AND d.own = 1
  `).get(mobileId) as OwnListingRow | null;
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
}

export interface DealerRowFull extends DealerRow {
  mobile_user?: string | null;
  mobile_password?: string | null;
  cars_user?: string | null;
  cars_password?: string | null;
}

export function getAllDealers(): DealerRow[] {
  // Credentials are excluded here — use getDealerById for the config UI where they're needed
  return raw.prepare('SELECT id, slug, name, own, active, priority, mobile_url FROM dealers ORDER BY priority DESC, name').all() as DealerRow[];
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
    SELECT l.id, l.mobile_id, l.title, l.make, l.model, l.reg_year, l.current_price
    FROM listings l
    JOIN dealers d ON l.dealer_id = d.id
    WHERE l.is_active = 1 AND d.own = 1
    ORDER BY l.make, l.model, l.reg_year
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

export function getMakeModelMappings(limit = 500): MakeModelMappingRow[] {
  return raw.prepare(`
    SELECT
      l.make,
      l.model,
      l.mobile_make_id,
      l.mobile_model_id,
      l.cars_make_id,
      l.cars_model_id,
      COUNT(*) as listing_count,
      MIN(l.mobile_id) as sample_mobile_id,
      MIN(l.title) as sample_title,
      GROUP_CONCAT(DISTINCT d.name) as dealer_names,
      MAX(l.last_edit) as latest_last_edit
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    WHERE l.is_active = 1
    GROUP BY
      l.make,
      l.model,
      l.mobile_make_id,
      l.mobile_model_id,
      l.cars_make_id,
      l.cars_model_id
    ORDER BY
      CASE
        WHEN l.mobile_make_id IS NULL OR l.mobile_model_id IS NULL OR l.cars_make_id IS NULL OR l.cars_model_id IS NULL THEN 0
        ELSE 1
      END,
      COUNT(*) DESC,
      l.make,
      l.model
    LIMIT ?
  `).all(limit) as MakeModelMappingRow[];
}

export function getMobileBgDashboardSummary(): MobileBgDashboardSummary {
  const runs = raw.prepare(`SELECT COUNT(*) as count FROM mobilebg_backup_runs`).get() as { count: number };
  const backups = raw.prepare(`SELECT COUNT(*) as count FROM mobilebg_backups`).get() as { count: number };
  const images = raw.prepare(`SELECT COUNT(*) as count FROM mobilebg_backup_images`).get() as { count: number };
  const editForms = raw.prepare(`SELECT COUNT(*) as count FROM mobilebg_edit_form_snapshots`).get() as { count: number };
  const repostJobs = raw.prepare(`SELECT COUNT(*) as count FROM mobilebg_repost_jobs`).get() as { count: number };
  return {
    runs: runs.count,
    backups: backups.count,
    images: images.count,
    editForms: editForms.count,
    repostJobs: repostJobs.count,
  };
}

export function getMobileBgBackupRuns(limit = 20): MobileBgBackupRunRow[] {
  return raw.prepare(`
    SELECT
      r.id, r.status, r.source_url, r.listings_count, r.images_count, r.notes,
      r.started_at, r.finished_at, r.created_at, r.updated_at,
      d.name as dealer_name, d.slug as dealer_slug
    FROM mobilebg_backup_runs r
    LEFT JOIN dealers d ON r.dealer_id = d.id
    ORDER BY COALESCE(r.started_at, r.created_at) DESC, r.id DESC
    LIMIT ?
  `).all(limit) as MobileBgBackupRunRow[];
}

export function getMobileBgBackups(limit = 100): MobileBgBackupListRow[] {
  return raw.prepare(`
    SELECT
      b.id, b.run_id, b.listing_id, b.mobile_id, b.source_url, b.source_title,
      b.make, b.model, b.title, b.price_amount, b.price_currency, b.image_count,
      b.created_at, b.updated_at,
      d.name as dealer_name, d.slug as dealer_slug
    FROM mobilebg_backups b
    LEFT JOIN dealers d ON b.dealer_id = d.id
    ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.id DESC
    LIMIT ?
  `).all(limit) as MobileBgBackupListRow[];
}

export function getMobileBgBackupById(id: number): (MobileBgBackupDetailRow & { images: MobileBgBackupImageRow[] }) | null {
  const row = raw.prepare(`
    SELECT
      b.id, b.run_id, b.listing_id, b.mobile_id, b.source_url, b.source_title,
      b.make, b.model, b.title, b.price_amount, b.price_currency, b.vat_included,
      b.year, b.mileage, b.fuel, b.power, b.engine, b.color, b.transmission,
      b.category, b.description, b.phones_json, b.extras_json, b.tech_data_json, b.photo_order_json,
      b.image_count, b.created_at, b.updated_at,
      d.name as dealer_name, d.slug as dealer_slug
    FROM mobilebg_backups b
    LEFT JOIN dealers d ON b.dealer_id = d.id
    WHERE b.id = ?
  `).get(id) as MobileBgBackupDetailRow | undefined;

  if (!row) return null;

  const images = raw.prepare(`
    SELECT id, backup_id, sort_order, filename, source_url, local_path, created_at
    FROM mobilebg_backup_images
    WHERE backup_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(id) as MobileBgBackupImageRow[];

  return { ...row, images };
}

export function getMobileBgEditForms(limit = 100): MobileBgEditFormRow[] {
  return raw.prepare(`
    SELECT
      e.id, e.backup_id, e.listing_id, e.mobile_id, e.source_url, e.listing_token,
      e.row_title, e.row_price_text, e.form_url, e.screenshot_path, e.created_at,
      d.name as dealer_name, d.slug as dealer_slug
    FROM mobilebg_edit_form_snapshots e
    LEFT JOIN dealers d ON e.dealer_id = d.id
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT ?
  `).all(limit) as MobileBgEditFormRow[];
}

export function getMobileBgEditFormById(id: number): MobileBgEditFormDetailRow | null {
  const row = raw.prepare(`
    SELECT
      e.id, e.backup_id, e.listing_id, e.mobile_id, e.source_url, e.listing_token,
      e.row_title, e.row_price_text, e.form_url, e.screenshot_path, e.created_at,
      e.forms_json, e.fields_json, e.checked_boxes_json, e.checked_radios_json, e.hidden_json,
      d.name as dealer_name, d.slug as dealer_slug
    FROM mobilebg_edit_form_snapshots e
    LEFT JOIN dealers d ON e.dealer_id = d.id
    WHERE e.id = ?
  `).get(id) as MobileBgEditFormDetailRow | undefined;
  return row ?? null;
}

export function getMobileBgRepostJobs(limit = 100): MobileBgRepostJobRow[] {
  return raw.prepare(`
    SELECT
      r.id, r.backup_id, r.listing_id, r.source_mobile_id, r.target_mobile_id, r.status,
      r.message, r.preview_screenshot_path, r.debug_dir, r.started_at, r.finished_at, r.created_at,
      d.name as dealer_name, d.slug as dealer_slug,
      b.title as backup_title
    FROM mobilebg_repost_jobs r
    LEFT JOIN dealers d ON r.dealer_id = d.id
    LEFT JOIN mobilebg_backups b ON r.backup_id = b.id
    ORDER BY COALESCE(r.started_at, r.created_at) DESC, r.id DESC
    LIMIT ?
  `).all(limit) as MobileBgRepostJobRow[];
}

export interface CompetitorStats {
  make: string;
  model: string;
  count: number;
  min_price: number | null;
  max_price: number | null;
  avg_price: number | null;
}

export function getCompetitorStatsByMakeModel(): Map<string, CompetitorStats> {
  const rows = raw.prepare(`
    SELECT
      make,
      model,
      COUNT(*) as count,
      MIN(price) as min_price,
      MAX(price) as max_price,
      CAST(AVG(price) AS INTEGER) as avg_price
    FROM competitor_listings
    WHERE price IS NOT NULL AND make IS NOT NULL
    GROUP BY make, model
  `).all() as CompetitorStats[];

  const map = new Map<string, CompetitorStats>();
  for (const row of rows) {
    map.set(`${row.make}|||${row.model}`, row);
  }
  return map;
}
