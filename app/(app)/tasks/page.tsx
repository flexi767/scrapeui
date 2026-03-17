'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';

interface TaskRow {
  id: number;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
  assignee_name: string | null;
  created_at: string;
}

const STATUS_OPTIONS = ['', 'backlog', 'in_progress', 'done', 'cancelled'];
const PRIORITY_OPTIONS = ['', 'urgent', 'high', 'medium', 'low'];

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    if (search) params.set('search', search);

    setLoading(true);
    fetch(`/api/tasks?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setTasks(data.data);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, [status, priority, search]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-gray-400">{total} tasks</p>
        </div>
        <Link href="/tasks/new">
          <Button>New Task</Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200"
        >
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.filter(Boolean).map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : tasks.length === 0 ? (
        <p className="text-gray-400">No tasks found.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/tasks/${task.id}`}
              className="flex items-center gap-4 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 transition-colors hover:border-gray-500"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-100">{task.title}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                  {task.assignee_name && <span>{task.assignee_name}</span>}
                  {task.deadline && (
                    <span className={isOverdue(task.deadline, task.status) ? 'text-red-400' : ''}>
                      Due {task.deadline}
                    </span>
                  )}
                </div>
              </div>
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function isOverdue(deadline: string, status: string): boolean {
  if (status === 'done' || status === 'cancelled') return false;
  return new Date(deadline) < new Date(new Date().toDateString());
}
