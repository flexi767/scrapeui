import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { currentIsoTimestamp, formatDateInputValue } from '@/lib/date-format';

interface NotificationQueryRow {
  id: number | null;
  user_id: number | null;
  type: string | null;
  entity_type: string | null;
  entity_id: number | null;
  title: string | null;
  read_at: string | null;
  created_at: string | null;
  unread_count: number;
}

const MarkReadSchema = z.object({
  ids: z.array(z.unknown()).optional(),
}).passthrough();

export async function GET() {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const userId = Number(session.user.id);

  // Check for overdue tasks and generate notifications
  generateOverdueNotifications(userId);

  const rows = raw.prepare(`
    WITH unread AS (
      SELECT COUNT(*) as unread_count
      FROM notifications
      WHERE user_id = ? AND read_at IS NULL
    ),
    recent AS (
      SELECT id, user_id, type, entity_type, entity_id, title, read_at, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    )
    SELECT recent.*, unread.unread_count
    FROM unread
    LEFT JOIN recent ON 1 = 1
  `).all(userId, userId) as NotificationQueryRow[];

  const unreadCount = rows[0]?.unread_count ?? 0;
  const notifications = rows
    .filter((row) => row.id !== null)
    .map((row) => ({
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      title: row.title,
      read_at: row.read_at,
      created_at: row.created_at,
    }));

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const rawBody = await request.json();
  const parsed = MarkReadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
  }
  const { ids } = parsed.data;
  const now = currentIsoTimestamp();

  if (ids && Array.isArray(ids)) {
    const ph = ids.map(() => '?').join(',');
    raw.prepare(`UPDATE notifications SET read_at = ? WHERE id IN (${ph}) AND user_id = ?`)
      .run(now, ...ids, Number(session.user.id));
  } else {
    // Mark all as read
    raw.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL')
      .run(now, Number(session.user.id));
  }

  return NextResponse.json({ ok: true });
}

function generateOverdueNotifications(userId: number) {
  const today = formatDateInputValue();
  const now = currentIsoTimestamp();

  // Find overdue tasks assigned to this user (or unassigned) and insert new notifications.
  raw.prepare(`
    INSERT INTO notifications (user_id, type, entity_type, entity_id, title, created_at)
    SELECT ?, 'task_overdue', 'task', t.id, 'Overdue: ' || t.title, ?
    FROM tasks t
    WHERE t.deadline < ? AND t.status NOT IN ('done', 'cancelled')
    AND (t.assignee_id = ? OR t.assignee_id IS NULL)
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.entity_type = 'task' AND n.entity_id = t.id
      AND n.type = 'task_overdue' AND n.user_id = ?
      AND n.created_at > date(?, '-1 day')
    )
  `).run(userId, now, today, userId, userId, now);
}
