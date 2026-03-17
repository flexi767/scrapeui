'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

interface NotificationItem {
  id: number;
  type: string;
  entity_type: string;
  entity_id: number;
  title: string;
  read_at: string | null;
  created_at: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000); // poll every 60s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function loadNotifications() {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((data) => {
        setNotifications(data.notifications || []);
        setUnread(data.unreadCount || 0);
      })
      .catch(() => {});
  }

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
  }

  function getUrl(n: NotificationItem): string {
    if (n.entity_type === 'task') return `/tasks/${n.entity_id}`;
    if (n.entity_type === 'expense') return `/expenses/${n.entity_id}`;
    return '#';
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-gray-700 bg-gray-800 shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
            <span className="text-sm font-medium text-gray-200">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">No notifications</p>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <Link
                  key={n.id}
                  href={getUrl(n)}
                  onClick={() => setOpen(false)}
                  className={`block border-b border-gray-700/50 px-4 py-2.5 text-sm transition-colors hover:bg-gray-700 ${
                    !n.read_at ? 'bg-gray-750' : ''
                  }`}
                >
                  <p className={`${n.read_at ? 'text-gray-400' : 'font-medium text-gray-100'}`}>
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {new Date(n.created_at).toLocaleDateString()}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );
}
