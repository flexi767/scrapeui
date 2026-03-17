'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { TiptapViewer } from '@/components/editor/TiptapViewer';
import { TiptapEditor } from '@/components/editor/TiptapEditor';

interface TaskDetail {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: number | null;
  assignee_name: string | null;
  creator_name: string | null;
  deadline: string | null;
  is_recurring: number;
  recur_rule: string | null;
  created_at: string;
  updated_at: string;
  listings: { id: number; mobile_id: string; title: string; make: string; model: string }[];
  labels: { id: number; name: string; color: string }[];
  subtasks: { id: number; title: string; status: string; priority: string }[];
  deps: { id: number; title: string; status: string }[];
}

interface CommentItem {
  id: number;
  body: string;
  author_name: string;
  created_at: string;
}

interface TimeEntryItem {
  id: number;
  description: string | null;
  duration_minutes: number;
  date: string;
  user_name: string;
}

interface ActivityItem {
  id: number;
  action: string;
  detail: string | null;
  user_name: string | null;
  created_at: string;
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntryItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const [commentBody, setCommentBody] = useState('');
  const [timeDuration, setTimeDuration] = useState('');
  const [timeDesc, setTimeDesc] = useState('');
  const [timeDate, setTimeDate] = useState(new Date().toISOString().split('T')[0]);

  function loadTask() {
    fetch(`/api/tasks/${id}`).then(r => r.json()).then(setTask);
  }

  function loadComments() {
    fetch(`/api/tasks/${id}/comments`).then(r => r.json()).then(setComments);
  }

  function loadTimeEntries() {
    fetch(`/api/tasks/${id}/time`).then(r => r.json()).then(setTimeEntries);
  }

  useEffect(() => {
    loadTask();
    loadComments();
    loadTimeEntries();
    // Activity is derived from the activity_log API - we'll query inline for now
    fetch(`/api/tasks/${id}`).then(r => r.json()).then(() => {
      // Load activity separately (using the task's entity)
    });
  }, [id]);

  async function handleStatusChange(newStatus: string) {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    loadTask();
  }

  async function addComment() {
    if (!commentBody.trim()) return;
    await fetch(`/api/tasks/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: commentBody }),
    });
    setCommentBody('');
    loadComments();
  }

  async function addTimeEntry() {
    if (!timeDuration || !timeDate) return;
    await fetch(`/api/tasks/${id}/time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: timeDesc || null,
        durationMinutes: Number(timeDuration),
        date: timeDate,
      }),
    });
    setTimeDuration('');
    setTimeDesc('');
    loadTimeEntries();
  }

  async function deleteTask() {
    if (!confirm('Delete this task?')) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    router.push('/tasks');
  }

  if (!task) return <p className="text-gray-400">Loading...</p>;

  const totalMinutes = timeEntries.reduce((sum, e) => sum + e.duration_minutes, 0);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          {task.is_recurring === 1 && (
            <span className="text-xs text-gray-400">Recurring</span>
          )}
        </div>
        <h1 className="text-2xl font-bold">{task.title}</h1>
        <div className="mt-1 flex items-center gap-4 text-sm text-gray-400">
          <span>Created by {task.creator_name}</span>
          {task.assignee_name && <span>Assigned to {task.assignee_name}</span>}
          {task.deadline && (
            <span className={isOverdue(task.deadline, task.status) ? 'text-red-400 font-medium' : ''}>
              Due {task.deadline}
            </span>
          )}
        </div>
      </div>

      {/* Status actions */}
      <div className="mb-6 flex flex-wrap gap-2">
        {task.status !== 'in_progress' && task.status !== 'done' && (
          <Button size="sm" onClick={() => handleStatusChange('in_progress')}>
            Start Working
          </Button>
        )}
        {task.status !== 'done' && (
          <Button size="sm" variant="outline" onClick={() => handleStatusChange('done')}>
            Mark Done
          </Button>
        )}
        {task.status !== 'cancelled' && task.status !== 'done' && (
          <Button size="sm" variant="outline" onClick={() => handleStatusChange('cancelled')}>
            Cancel
          </Button>
        )}
        {(task.status === 'done' || task.status === 'cancelled') && (
          <Button size="sm" variant="outline" onClick={() => handleStatusChange('backlog')}>
            Reopen
          </Button>
        )}
        <Link href={`/tasks/${id}/edit`}>
          <Button size="sm" variant="outline">Edit</Button>
        </Link>
        <Button size="sm" variant="destructive" onClick={deleteTask}>Delete</Button>
      </div>

      {/* Linked entities */}
      {task.listings.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1 text-sm font-medium text-gray-400">Linked Cars</h3>
          <div className="flex flex-wrap gap-2">
            {task.listings.map((l) => (
              <Link
                key={l.id}
                href={`/listings/${l.mobile_id}`}
                className="rounded-md border border-gray-600 px-2 py-1 text-xs hover:border-gray-400"
              >
                {l.make} {l.model} — {l.title || l.mobile_id}
              </Link>
            ))}
          </div>
        </div>
      )}

      {task.labels.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <span
              key={l.id}
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: l.color, color: '#fff' }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      {task.description && (
        <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800 p-4">
          <TiptapViewer content={task.description} />
        </div>
      )}

      {/* Subtasks */}
      {task.subtasks.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-medium text-gray-400">Subtasks</h3>
          <div className="space-y-1">
            {task.subtasks.map((st) => (
              <Link
                key={st.id}
                href={`/tasks/${st.id}`}
                className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-800"
              >
                <StatusBadge status={st.status} />
                <span>{st.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tabs: Comments, Time, Activity */}
      <Tabs defaultValue="comments" className="mt-6">
        <TabsList className="bg-gray-800">
          <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
          <TabsTrigger value="time">
            Time ({totalMinutes ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : '0'})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comments" className="mt-4 space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-gray-700 bg-gray-800 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm text-gray-400">
                <span className="font-medium text-gray-200">{c.author_name}</span>
                <span>{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
              <TiptapViewer content={c.body} />
            </div>
          ))}

          <div className="space-y-2">
            <TiptapEditor
              content={commentBody}
              onChange={setCommentBody}
              placeholder="Write a comment..."
            />
            <Button size="sm" onClick={addComment}>Add Comment</Button>
          </div>
        </TabsContent>

        <TabsContent value="time" className="mt-4 space-y-4">
          {timeEntries.length > 0 && (
            <div className="rounded-lg border border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-left text-gray-400">
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Duration</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2">User</th>
                  </tr>
                </thead>
                <tbody>
                  {timeEntries.map((te) => (
                    <tr key={te.id} className="border-b border-gray-700/50">
                      <td className="px-4 py-2">{te.date}</td>
                      <td className="px-4 py-2">
                        {Math.floor(te.duration_minutes / 60)}h {te.duration_minutes % 60}m
                      </td>
                      <td className="px-4 py-2 text-gray-300">{te.description || '—'}</td>
                      <td className="px-4 py-2 text-gray-400">{te.user_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Minutes</label>
              <Input
                type="number"
                value={timeDuration}
                onChange={(e) => setTimeDuration(e.target.value)}
                placeholder="60"
                className="w-24"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Date</label>
              <Input
                type="date"
                value={timeDate}
                onChange={(e) => setTimeDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-gray-400">Description</label>
              <Input
                value={timeDesc}
                onChange={(e) => setTimeDesc(e.target.value)}
                placeholder="What did you work on?"
              />
            </div>
            <Button size="sm" onClick={addTimeEntry}>Log Time</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function isOverdue(deadline: string, status: string): boolean {
  if (status === 'done' || status === 'cancelled') return false;
  return new Date(deadline) < new Date(new Date().toDateString());
}
