'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { type PageKey } from '@/lib/page-permissions';
import { QuickAdd } from '@/components/QuickAdd';
import { NotificationBell } from '@/components/NotificationBell';
import { LanguageSelector } from '@/components/LanguageSelector';
import { locales } from '@/i18n/routing';

const localePrefixPattern = new RegExp(
  `^/(${locales.map((locale) => locale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=/|$)`,
);

function stripLocalePrefix(pathname: string) {
  return pathname.replace(localePrefixPattern, '') || '/';
}

function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function pathMatchesAny(pathname: string, matches: string[]) {
  return matches.some((match) => pathMatches(pathname, match));
}

export function AppSidebar() {
  const t = useTranslations('ui');
  const pathname = stripLocalePrefix(usePathname());
  const { data: session } = useSession();

  const role = session?.user?.role;
  const pageKeys = session?.user?.pageKeys;

  function isVisible(key: PageKey | null): boolean {
    if (key === null) return true;
    if (role === 'admin') return true;
    if (!pageKeys) return false;
    return (pageKeys as string[]).includes(key);
  }

  const navItems = [
    { href: '/dashboard', label: t('dashboard'), icon: DashboardIcon, match: ['/dashboard'], pageKey: null },
    { href: '/listings', label: t('listings'), icon: CarIcon, match: ['/listings'], pageKey: 'listings' as PageKey },
    { href: '/editown', label: t('edit_own'), icon: EditIcon, match: ['/editown', '/facebook-marketplace'], pageKey: 'editown' as PageKey },
    { href: '/mobilebg', label: t('mobile_bg'), icon: ArchiveIcon, match: ['/mobilebg'], pageKey: 'mobilebg' as PageKey },
    { href: '/tasks', label: t('tasks'), icon: TaskIcon, match: ['/tasks'], pageKey: 'tasks' as PageKey },
    { href: '/expenses', label: t('expenses'), icon: ExpenseIcon, match: ['/expenses'], pageKey: 'expenses' as PageKey },
    { href: '/templates', label: t('templates'), icon: TemplateIcon, match: ['/templates'], pageKey: 'templates' as PageKey },
    { href: '/translations', label: 'Translations', icon: TranslateIcon, match: ['/translations'], pageKey: 'translations' as PageKey },
    { href: '/config', label: t('config'), icon: GearIcon, match: ['/config', '/dealers'], pageKey: 'config' as PageKey },
  ];

  const sectionItems = [
    {
      id: 'listings',
      match: ['/listings'],
      links: [
        { href: '/listings', label: t('all_listings'), icon: CarIcon, pageKey: 'listings' as PageKey },
        { href: '/listings/changes', label: t('changes'), icon: ClockIcon, pageKey: 'listings' as PageKey },
        { href: '/listings/deleted', label: t('deleted'), icon: TrashIcon, pageKey: 'listings' as PageKey },
      ],
    },
    {
      id: 'editown',
      match: ['/editown', '/facebook-marketplace'],
      links: [
        { href: '/editown', label: t('own_listings'), icon: EditIcon, pageKey: 'editown' as PageKey },
        { href: '/editown/sync', label: t('batch_sync'), icon: UploadIcon, pageKey: 'editown' as PageKey },
        { href: '/editown/carsbg-sync', label: t('cars_bg_sync'), icon: UploadIcon, pageKey: 'editown' as PageKey },
        { href: '/editown/new', label: t('new_listing'), icon: PlusIcon, pageKey: 'editown' as PageKey },
        { href: '/editown/saved-searches', label: t('saved_searches'), icon: SearchIcon, pageKey: 'editown' as PageKey },
        { href: '/editown/search-positions', label: t('search_positions'), icon: SearchIcon, pageKey: 'editown' as PageKey },
        { href: '/facebook-marketplace/bookmarklet', label: t('fb_bookmarklet'), icon: UploadIcon, pageKey: 'editown' as PageKey },
      ],
    },
    {
      id: 'mobilebg',
      match: ['/mobilebg'],
      links: [
        { href: '/mobilebg', label: t('overview'), icon: ArchiveIcon, pageKey: 'mobilebg' as PageKey },
        { href: '/mobilebg/edit-forms', label: t('edit_forms'), icon: FormIcon, pageKey: 'mobilebg' as PageKey },
        { href: '/mobilebg/reposts', label: t('reposts'), icon: UploadIcon, pageKey: 'mobilebg' as PageKey },
      ],
    },
    {
      id: 'tasks',
      match: ['/tasks'],
      links: [
        { href: '/tasks', label: t('all_tasks'), icon: TaskIcon, pageKey: 'tasks' as PageKey },
        { href: '/tasks/my', label: t('my_tasks'), icon: UserTaskIcon, pageKey: 'tasks' as PageKey },
      ],
    },
    {
      id: 'workspace',
      match: ['/mapping', '/kb', '/files'],
      links: [
        { href: '/mapping', label: t('mapping'), icon: MapIcon, pageKey: 'mapping' as PageKey },
        { href: '/kb', label: t('knowledge_base'), icon: BookIcon, pageKey: 'kb' as PageKey },
        { href: '/files', label: t('files'), icon: FileIcon, pageKey: 'files' as PageKey },
      ],
    },
  ];

  const dealerId = session?.user?.dealerId;
  const visibleSectionItems = sectionItems.filter((section) =>
    section.links.some((l) => isVisible(l.pageKey))
  );
  const activeSection = visibleSectionItems.find((section) => pathMatchesAny(pathname, section.match));

  return (
    <header className="sticky top-0 z-40 border-b border-gray-700 bg-gray-950/95 shadow-lg shadow-black/10 backdrop-blur">
      <div className="flex min-h-10 items-center gap-2 px-3">
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1">
          {navItems.filter((item) => isVisible(item.pageKey)).map((item) => {
            const active = pathMatchesAny(pathname, item.match);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-800/80 hover:text-gray-200',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <LanguageSelector />
          <QuickAdd />
          <NotificationBell />
          {dealerId && (
            <Link
              href={`/dealers/${dealerId}/credentials`}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              title={t("my_settings")}
              aria-label={t("my_settings")}
            >
              <GearIcon className="h-4 w-4" />
            </Link>
          )}
          <div className="hidden min-w-0 max-w-32 sm:block">
            <p className="truncate text-xs font-medium text-gray-200">
              {session?.user?.name}
            </p>
            <p className="truncate text-[11px] text-gray-500">
              {session?.user?.role}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            title={t("sign_out")}
            aria-label={t("sign_out")}
          >
            <LogoutIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {activeSection && (
        <div className="flex min-h-7 items-center gap-1.5 border-t border-gray-800 px-3">
          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5">
            {activeSection.links.filter((link) => isVisible(link.pageKey)).map((item) => {
              const active = pathMatches(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex h-6 shrink-0 items-center gap-1 rounded px-1.5 text-[11px] font-medium transition-colors',
                    active
                      ? 'bg-gray-800 text-gray-100'
                      : 'text-gray-500 hover:bg-gray-800/70 hover:text-gray-300',
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h6.75v6.75H3.75V3.75Zm0 9.75h6.75v6.75H3.75V13.5Zm9.75-9.75h6.75v10.5H13.5V3.75Zm0 13.5h6.75v3H13.5v-3Z" />
    </svg>
  );
}

// ─── Inline SVG icons ──────────────────────────────────────────────

function CarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25m-4.5 0H5.106a2.056 2.056 0 0 0-1.58.86A17.902 17.902 0 0 0 .314 17.126c-.04.62.468 1.124 1.09 1.124H2.25" />
    </svg>
  );
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 20.25 6-2.25m0 0 6 2.25V6.75L15 4.5m0 13.5-6 2.25m6-15.75-6 2.25m0 13.5L3 18V4.5l6 2.25m0 13.5V6.75" />
    </svg>
  );
}

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5H3.75m16.5 0-1.4 9.795a2.25 2.25 0 0 1-2.228 1.955H7.378A2.25 2.25 0 0 1 5.15 17.295L3.75 7.5m16.5 0V5.25A2.25 2.25 0 0 0 18 3H6a2.25 2.25 0 0 0-2.25 2.25V7.5m5.25 4.5h6" />
    </svg>
  );
}

function FormIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 21h-15A2.25 2.25 0 0 1 2.25 18.75V5.25A2.25 2.25 0 0 1 4.5 3h9.879a2.25 2.25 0 0 1 1.591.659l3.371 3.371A2.25 2.25 0 0 1 20 8.621V18.75A2.25 2.25 0 0 1 17.75 21ZM7.5 12h9m-9 3h6m-6-6h3" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v1.125A2.625 2.625 0 0 0 5.625 20.25h12.75A2.625 2.625 0 0 0 21 17.625V16.5m-12-9 3-3m0 0 3 3m-3-3v12" />
    </svg>
  );
}

function TaskIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function UserTaskIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

function ExpenseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function TemplateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M3 9h18M3 15h18" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.38.138.75.43.992l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931ZM19.5 7.125 16.875 4.5" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.6-5.15a6.75 6.75 0 1 1-13.5 0 6.75 6.75 0 0 1 13.5 0Z" />
    </svg>
  );
}

function TranslateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21 15 3m-8.25 5.25h9.75M4.5 5.25h12m-10.5 0c.5 3.5 2.25 6.25 5.25 8.25m3.75-8.25c-.5 2.75-1.75 5-3.75 6.75m6 9 1.125-2.625m0 0L19.5 15h.75l1.125 3.375m-2.25 0h2.25" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7.5h12m-9.75 0V6a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 .75.75v1.5m-9.75 0v9.75A2.25 2.25 0 0 0 9 19.5h6a2.25 2.25 0 0 0 2.25-2.25V7.5M10.5 11.25v4.5m3-4.5v4.5" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
