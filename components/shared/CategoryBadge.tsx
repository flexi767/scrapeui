import { cn } from '@/lib/utils';

const categoryColors: Record<string, string> = {
  transport: 'bg-blue-600 text-blue-100',
  repair: 'bg-orange-600 text-orange-100',
  registration: 'bg-purple-600 text-purple-100',
  detailing: 'bg-cyan-600 text-cyan-100',
  ads: 'bg-pink-600 text-pink-100',
  fuel: 'bg-yellow-600 text-yellow-100',
  paperwork: 'bg-gray-500 text-gray-100',
  salary: 'bg-green-600 text-green-100',
  office: 'bg-indigo-600 text-indigo-100',
  other: 'bg-gray-600 text-gray-200',
};

export const EXPENSE_CATEGORIES = [
  'transport', 'repair', 'registration', 'detailing', 'ads',
  'fuel', 'paperwork', 'salary', 'office', 'other',
] as const;

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        categoryColors[category] ?? 'bg-gray-600 text-gray-200',
      )}
    >
      {category}
    </span>
  );
}
