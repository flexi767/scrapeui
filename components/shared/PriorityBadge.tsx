import { cn } from '@/lib/utils';

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-600 text-red-100',
  high: 'bg-orange-600 text-orange-100',
  medium: 'bg-yellow-600 text-yellow-100',
  low: 'bg-gray-600 text-gray-200',
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        priorityColors[priority] ?? 'bg-gray-600 text-gray-200',
      )}
    >
      {priority}
    </span>
  );
}
