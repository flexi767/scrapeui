import { raw } from '@/db/client';
import type { LabelRow, ListingSummary } from './core';
import { getWindowTotal, omitQueryFields, timedQuery, toFtsPrefixQuery } from './query-utils';
import {
  getRelatedLabels,
  getRelatedListingSummaries,
  getRelatedUploads,
  type UploadSummary,
} from './relations';

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
    const ftsQuery = toFtsPrefixQuery(search);
    if (ftsQuery) {
      wheres.push(`EXISTS (
        SELECT 1
        FROM expenses_search_fts
        WHERE expenses_search_fts.rowid = e.id
          AND expenses_search_fts MATCH ?
      )`);
      params.push(ftsQuery);
    }
  }

  const where = wheres.length ? `WHERE ${wheres.join(" AND ")}` : "";
  const offset = (page - 1) * limit;
  const queryDetails = {
    page,
    limit,
    filters: {
      category: Boolean(category),
      dateFrom: Boolean(dateFrom),
      dateTo: Boolean(dateTo),
      search: Boolean(search),
    },
  };

  const rows = timedQuery('expenses.page', queryDetails, () => raw
      .prepare(
        `
    SELECT COUNT(*) OVER() as total_count,
      COALESCE(SUM(e.amount) OVER(), 0) as total_amount,
      e.*, u.name as creator_name
    FROM expenses e
    LEFT JOIN users u ON u.id = e.created_by_id
    ${where}
    ORDER BY e.date DESC, e.created_at DESC
    LIMIT ? OFFSET ?
  `,
      )
      .all(...params, limit, offset) as Array<ExpenseRow & { total_count: number; total_amount: number }>);

  const getExpenseTotals = () => {
    const totals = timedQuery('expenses.totals', queryDetails, () => raw
        .prepare(
          `
    SELECT COUNT(*) as count, COALESCE(SUM(e.amount), 0) as total_amount
    FROM expenses e
    ${where}
  `,
        )
        .get(...params) as { count: number; total_amount: number });
    return totals;
  };

  const firstRow = rows[0];
  const fallbackTotals = firstRow ? null : page > 1 ? getExpenseTotals() : { count: 0, total_amount: 0 };

  return {
    data: rows.map((row) => omitQueryFields(row, ['total_count', 'total_amount'])),
    total: firstRow?.total_count ?? fallbackTotals?.count ?? 0,
    totalAmount: firstRow?.total_amount ?? fallbackTotals?.total_amount ?? 0,
    page,
    limit,
  };
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

  const listings = getRelatedListingSummaries('expense', id);

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

  const labels = getRelatedLabels('expense', id);
  const uploads = getRelatedUploads('expense', id);

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

export type ArticleDetailRow = ArticleRow & {
  labels: LabelRow[];
  listings: ListingSummary[];
  uploads: UploadSummary[];
};

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
    const ftsQuery = toFtsPrefixQuery(search);
    if (ftsQuery) {
      wheres.push(`EXISTS (
        SELECT 1
        FROM articles_search_fts
        WHERE articles_search_fts.rowid = a.id
          AND articles_search_fts MATCH ?
      )`);
      params.push(ftsQuery);
    }
  }
  if (labelId) {
    wheres.push(
      "EXISTS (SELECT 1 FROM article_labels al WHERE al.article_id = a.id AND al.label_id = ?)",
    );
    params.push(labelId);
  }

  const where = wheres.length ? `WHERE ${wheres.join(" AND ")}` : "";
  const offset = (page - 1) * limit;
  const queryDetails = {
    page,
    limit,
    filters: {
      search: Boolean(search),
      labelId: Boolean(labelId),
    },
  };

  const rows = timedQuery('articles.page', queryDetails, () => raw
      .prepare(
        `
    SELECT COUNT(*) OVER() as total_count,
      a.*, u.name as author_name
    FROM articles a
    LEFT JOIN users u ON u.id = a.author_id
    ${where}
    ORDER BY a.updated_at DESC
    LIMIT ? OFFSET ?
  `,
      )
      .all(...params, limit, offset) as Array<ArticleRow & { total_count: number }>);

  const countArticles = () => {
    const { count } = timedQuery('articles.count', queryDetails, () => raw
        .prepare(
          `
    SELECT COUNT(*) as count FROM articles a ${where}
  `,
        )
        .get(...params) as { count: number });
    return count;
  };

  return {
    data: rows.map((row) => omitQueryFields(row, ['total_count'])),
    total: getWindowTotal(rows, page, countArticles, 'total_count'),
    page,
    limit,
  };
}

export function getArticleById(id: number): ArticleDetailRow | null {
  const article = raw
    .prepare(
      `
    SELECT a.*, u.name as author_name
    FROM articles a
    LEFT JOIN users u ON u.id = a.author_id
    WHERE a.id = ?
  `,
    )
    .get(id) as ArticleRow | undefined;

  if (!article) return null;

  const listings = getRelatedListingSummaries('article', id);
  const labels = getRelatedLabels('article', id);
  const uploads = getRelatedUploads('article', id);

  return { ...article, labels, listings, uploads };
}
