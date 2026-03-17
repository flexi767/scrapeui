import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = Number(session.user.id);

  // Check for overdue tasks and generate notifications
  generateOverdueNotifications(userId);

  const notifications = raw.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(userId);

  const unreadCount = raw.prepare(`
    SELECT COUNT(*) as count FROM notifications
    WHERE user_id = ? AND read_at IS NULL
  `).get(userId) as { count: number };

  return NextResponse.json({ notifications, unreadCount: unreadCount.count });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ids } = await request.json();
  const now = new Date().toISOString();

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
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  // Find overdue tasks assigned to this user (or unassigned)
  const overdue = raw.prepare(`
    SELECT t.id, t.title FROM tasks t
    WHERE t.deadline < ? AND t.status NOT IN ('done', 'cancelled')
    AND (t.assignee_id = ? OR t.assignee_id IS NULL)
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.entity_type = 'task' AND n.entity_id = t.id
      AND n.type = 'task_overdue' AND n.user_id = ?
      AND n.created_at > date(?, '-1 day')
    )
  `).all(today, userId, userId, now) as { id: number; title: string }[];

  const insert = raw.prepare(`
    INSERT INTO notifications (user_id, type, entity_type, entity_id, title, created_at)
    VALUES (?, 'task_overdue', 'task', ?, ?, ?)
  `);

  for (const t of overdue) {
    insert.run(userId, t.id, `Overdue: ${t.title}`, now);
  }
}
