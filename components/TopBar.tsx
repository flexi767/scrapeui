'use client';

import { QuickAdd } from '@/components/QuickAdd';
import { NotificationBell } from '@/components/NotificationBell';

export function TopBar() {
  return (
    <div className="flex h-12 items-center justify-between border-b border-gray-700 bg-gray-900 px-4">
      <QuickAdd />
      <NotificationBell />
    </div>
  );
}
