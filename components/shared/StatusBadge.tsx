import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  backlog: 'bg-gray-600 text-gray-200',
  in_progress: 'bg-blue-600 text-blue-100',
  done: 'bg-green-600 text-green-100',
  cancelled: 'bg-red-900 text-red-200',
};

const statusLabels: Record<string, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        statusColors[status] ?? 'bg-gray-600 text-gray-200',
      )}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}
