'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';

interface TaskRow {
  id: number;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
  assignee_name: string | null;
}

export default function MyTasksPage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/tasks?assigneeId=${session.user.id}`)
      .then((r) => r.json())
      .then((data) => setTasks(data.data))
      .finally(() => setLoading(false));
  }, [session?.user?.id]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">My Tasks</h1>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : tasks.length === 0 ? (
        <p className="text-gray-400">No tasks assigned to you.</p>
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
                {task.deadline && (
                  <p className="mt-0.5 text-xs text-gray-400">Due {task.deadline}</p>
                )}
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
