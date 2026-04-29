import { raw } from '@/db/client';
import type { LabelRow, ListingSummary } from './core';

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
  const {
    status,
    priority,
    assigneeId,
    search,
    page = 1,
    limit = 50,
  } = filters;
  const wheres: string[] = [];
  const params: (string | number)[] = [];

  if (status) {
    wheres.push("t.status = ?");
    params.push(status);
  }
  if (priority) {
    wheres.push("t.priority = ?");
    params.push(priority);
  }
  if (assigneeId) {
    wheres.push("t.assignee_id = ?");
    params.push(assigneeId);
  }
  if (search) {
    wheres.push("(t.title LIKE ?)");
    params.push(`%${search}%`);
  }

  const where = wheres.length ? `WHERE ${wheres.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const rows = raw
    .prepare(
      `
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
  `,
    )
    .all(...params, limit, offset) as TaskRow[];

  const { count } = raw
    .prepare(
      `
    SELECT COUNT(*) as count FROM tasks t ${where}
  `,
    )
    .get(...params) as { count: number };

  return { data: rows, total: count, page, limit };
}

export function getTaskById(id: number) {
  const task = raw
    .prepare(
      `
    SELECT t.*,
      a.name as assignee_name,
      c.name as creator_name
    FROM tasks t
    LEFT JOIN users a ON a.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by_id
    WHERE t.id = ?
  `,
    )
    .get(id) as TaskRow | undefined;

  if (!task) return null;

  const listings = raw
    .prepare(
      `
    SELECT l.id, l.mobile_id, l.title, l.make, l.model, l.reg_year, l.current_price
    FROM task_listings tl
    JOIN listings l ON l.id = tl.listing_id
    WHERE tl.task_id = ?
  `,
    )
    .all(id) as ListingSummary[];

  const labels = raw
    .prepare(
      `
    SELECT lb.id, lb.name, lb.color
    FROM task_labels tl
    JOIN labels lb ON lb.id = tl.label_id
    WHERE tl.task_id = ?
  `,
    )
    .all(id) as LabelRow[];

  const subtasks = raw
    .prepare(
      `
    SELECT t.id, t.title, t.status, t.priority
    FROM tasks t WHERE t.parent_id = ?
    ORDER BY t.created_at
  `,
    )
    .all(id) as {
    id: number;
    title: string;
    status: string;
    priority: string;
  }[];

  const deps = raw
    .prepare(
      `
    SELECT t.id, t.title, t.status
    FROM task_deps td
    JOIN tasks t ON t.id = td.depends_on_id
    WHERE td.task_id = ?
  `,
    )
    .all(id) as { id: number; title: string; status: string }[];

  return { ...task, listings, labels, subtasks, deps };
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
  return raw
    .prepare(
      `
    SELECT c.*, u.name as author_name
    FROM comments c
    JOIN users u ON u.id = c.author_id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `,
    )
    .all(taskId) as CommentRow[];
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
  return raw
    .prepare(
      `
    SELECT te.*, u.name as user_name
    FROM time_entries te
    JOIN users u ON u.id = te.user_id
    WHERE te.task_id = ?
    ORDER BY te.date DESC, te.created_at DESC
  `,
    )
    .all(taskId) as TimeEntryRow[];
}
