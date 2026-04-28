import { raw } from '@/db/client';
import type { LabelRow, ListingSummary } from './core';

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

  if (category) {
    wheres.push("e.category = ?");
    params.push(category);
  }
  if (dateFrom) {
    wheres.push("e.date >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    wheres.push("e.date <= ?");
    params.push(dateTo);
  }
  if (search) {
    wheres.push("e.title LIKE ?");
    params.push(`%${search}%`);
  }

  const where = wheres.length ? `WHERE ${wheres.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const rows = raw
    .prepare(
      `
    SELECT e.*, u.name as creator_name
    FROM expenses e
    LEFT JOIN users u ON u.id = e.created_by_id
    ${where}
    ORDER BY e.date DESC, e.created_at DESC
    LIMIT ? OFFSET ?
  `,
    )
    .all(...params, limit, offset) as ExpenseRow[];

  const { count } = raw
    .prepare(
      `
    SELECT COUNT(*) as count FROM expenses e ${where}
  `,
    )
    .get(...params) as { count: number };

  const { total_amount } = raw
    .prepare(
      `
    SELECT COALESCE(SUM(e.amount), 0) as total_amount FROM expenses e ${where}
  `,
    )
    .get(...params) as { total_amount: number };

  return { data: rows, total: count, totalAmount: total_amount, page, limit };
}

export function getExpenseById(id: number) {
  const expense = raw
    .prepare(
      `
    SELECT e.*, u.name as creator_name
    FROM expenses e
    LEFT JOIN users u ON u.id = e.created_by_id
    WHERE e.id = ?
  `,
    )
    .get(id) as ExpenseRow | undefined;

  if (!expense) return null;

  const listings = raw
    .prepare(
      `
    SELECT l.id, l.mobile_id, l.title, l.make, l.model, l.reg_year, l.current_price
    FROM expense_listings el
    JOIN listings l ON l.id = el.listing_id
    WHERE el.expense_id = ?
  `,
    )
    .all(id) as ListingSummary[];

  const tasks = raw
    .prepare(
      `
    SELECT t.id, t.title, t.status
    FROM expense_tasks et
    JOIN tasks t ON t.id = et.task_id
    WHERE et.expense_id = ?
  `,
    )
    .all(id) as { id: number; title: string; status: string }[];

  const labels = raw
    .prepare(
      `
    SELECT lb.id, lb.name, lb.color
    FROM expense_labels el
    JOIN labels lb ON lb.id = el.label_id
    WHERE el.expense_id = ?
  `,
    )
    .all(id) as LabelRow[];

  const uploads = raw
    .prepare(
      `
    SELECT * FROM uploads
    WHERE entity_type = 'expense' AND entity_id = ?
    ORDER BY created_at DESC
  `,
    )
    .all(id);

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

  if (search) {
    wheres.push("a.title LIKE ?");
    params.push(`%${search}%`);
  }
  if (labelId) {
    wheres.push(
      "EXISTS (SELECT 1 FROM article_labels al WHERE al.article_id = a.id AND al.label_id = ?)",
    );
    params.push(labelId);
  }

  const where = wheres.length ? `WHERE ${wheres.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const rows = raw
    .prepare(
      `
    SELECT a.*, u.name as author_name
    FROM articles a
    LEFT JOIN users u ON u.id = a.author_id
    ${where}
    ORDER BY a.updated_at DESC
    LIMIT ? OFFSET ?
  `,
    )
    .all(...params, limit, offset) as ArticleRow[];

  const { count } = raw
    .prepare(
      `
    SELECT COUNT(*) as count FROM articles a ${where}
  `,
    )
    .get(...params) as { count: number };

  return { data: rows, total: count, page, limit };
}

export function getArticleBySlug(slug: string) {
  const article = raw
    .prepare(
      `
    SELECT a.*, u.name as author_name
    FROM articles a
    LEFT JOIN users u ON u.id = a.author_id
    WHERE a.slug = ?
  `,
    )
    .get(slug) as ArticleRow | undefined;

  if (!article) return null;

  const labels = raw
    .prepare(
      `
    SELECT lb.id, lb.name, lb.color
    FROM article_labels al
    JOIN labels lb ON lb.id = al.label_id
    WHERE al.article_id = ?
  `,
    )
    .all(article.id) as LabelRow[];

  const listings = raw
    .prepare(
      `
    SELECT l.id, l.mobile_id, l.title, l.make, l.model, l.reg_year, l.current_price
    FROM article_listings al
    JOIN listings l ON l.id = al.listing_id
    WHERE al.article_id = ?
  `,
    )
    .all(article.id) as ListingSummary[];

  const uploads = raw
    .prepare(
      `
    SELECT * FROM uploads
    WHERE entity_type = 'article' AND entity_id = ?
    ORDER BY created_at DESC
  `,
    )
    .all(article.id);

  return { ...article, labels, listings, uploads };
}

// ─── Tasks by Listing ─────────────────────────────────────────────

export function getTasksByListing(listingId: number) {
  return raw
    .prepare(
      `
    SELECT t.id, t.title, t.status, t.priority, t.deadline, t.created_at,
      a.name as assignee_name
    FROM task_listings tl
    JOIN tasks t ON t.id = tl.task_id
    LEFT JOIN users a ON a.id = t.assignee_id
    WHERE tl.listing_id = ?
    ORDER BY
      CASE t.status WHEN 'in_progress' THEN 0 WHEN 'backlog' THEN 1 WHEN 'done' THEN 2 WHEN 'cancelled' THEN 3 END,
      t.created_at DESC
  `,
    )
    .all(listingId);
}

// ─── Expenses by Listing ──────────────────────────────────────────

export function getExpensesByListing(listingId: number) {
  return raw
    .prepare(
      `
    SELECT e.id, e.title, e.amount, e.currency, e.date, e.category
    FROM expense_listings el
    JOIN expenses e ON e.id = el.expense_id
    WHERE el.listing_id = ?
    ORDER BY e.date DESC
  `,
    )
    .all(listingId);
}
