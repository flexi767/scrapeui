'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import {
  CarFront,
  ArchiveIcon,
  EditIcon,
  MapIcon,
  ListTodo,
  BookIcon,
  SettingsIcon,
  TrendingUp,
  Clock,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardStats {
  totalListings: number;
  activeListings: number;
  lastScrapingAt: string | null;
  totalDealers: number;
}

interface Dealer {
  id: number;
  slug: string;
  name: string;
  own: number;
  active: number;
  mobile_url: string | null;
  priority: number;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function Dashboard() {
  const { data: session, status: sessionStatus } = useSession();
  const t = useTranslations('ui');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = session?.user?.role === 'admin';

  const navigationLinks = [
    { href: '/listings', label: t('listings'), icon: CarFront, description: t('browse_all_car_listings') },
    { href: '/editown', label: t('edit_own'), icon: EditIcon, description: t('manage_your_listings') },
    { href: '/mobilebg', label: t('mobile_bg'), icon: ArchiveIcon, description: t('mobile_bg_integrations') },
    { href: '/mapping', label: t('mapping'), icon: MapIcon, description: t('brand_&_model_mapping') },
    { href: '/tasks', label: t('tasks'), icon: ListTodo, description: t('my_tasks') },
    { href: '/kb', label: t('knowledge_base'), icon: BookIcon, description: t('knowledge_base') },
    { href: '/config', label: t('config'), icon: SettingsIcon, description: t('configuration') },
  ];

  useEffect(() => {
    if (sessionStatus === 'loading') return;

    let cancelled = false;
    let inFlight: AbortController | null = null;
    let lastFetchAt = 0;

    const fetchData = async ({
      showLoading = false,
      force = false,
    }: {
      showLoading?: boolean;
      force?: boolean;
    } = {}) => {
      const now = Date.now();
      if (inFlight) return;
      if (!force && now - lastFetchAt < 15000) return;

      const controller = new AbortController();
      inFlight = controller;
      if (showLoading) setLoading(true);
      try {
        const [statsRes, dealersRes] = await Promise.all([
          fetch('/api/dashboard/stats', { signal: controller.signal }),
          isAdmin ? fetch('/api/dealers', { signal: controller.signal }) : Promise.resolve(null),
        ]);
        if (!statsRes.ok) throw new Error(`Stats request failed: ${statsRes.status}`);
        if (dealersRes && !dealersRes.ok) throw new Error(`Dealers request failed: ${dealersRes.status}`);
        const statsData = await statsRes.json();
        const dealersData = dealersRes ? await dealersRes.json() : [];
        if (cancelled) return;
        lastFetchAt = Date.now();
        setStats(statsData);
        setDealers(Array.isArray(dealersData) ? dealersData : []);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to fetch dashboard data:', error);
        }
      } finally {
        if (inFlight === controller) inFlight = null;
        if (!cancelled) setLoading(false);
      }
    };

    fetchData({ showLoading: true, force: true });

    const intervalId = window.setInterval(() => {
      fetchData();
    }, 60000);

    const onFocus = () => {
      fetchData();
    };

    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      inFlight?.abort();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [isAdmin, sessionStatus]);

  const activeDealers = dealers.filter(d => d.active);
  const ownDealers = activeDealers.filter(d => d.own);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-8 p-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">{t('dashboard')}</h1>
          <p className="text-gray-400">{t('project_overview_and_quick_links')}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Listings */}
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-400">{t('total_listings')}</p>
                {loading ? (
                  <div className="h-8 w-16 animate-pulse rounded bg-gray-700" />
                ) : (
                  <p className="text-3xl font-bold text-white">{stats?.totalListings ?? 0}</p>
                )}
              </div>
              <div className="rounded-lg bg-blue-500/10 p-3">
                <CarFront className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </div>

          {/* Active Listings */}
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-400">{t('active_listings')}</p>
                {loading ? (
                  <div className="h-8 w-16 animate-pulse rounded bg-gray-700" />
                ) : (
                  <>
                    <p className="text-3xl font-bold text-white">{stats?.activeListings ?? 0}</p>
                    {stats && (
                      <p className="text-xs text-gray-500">
                        {((stats.activeListings / stats.totalListings) * 100).toFixed(0)}% {t('of_total')}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="rounded-lg bg-green-500/10 p-3">
                <TrendingUp className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </div>

          {/* Total Dealers */}
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-400">{t('active_dealers')}</p>
                {loading ? (
                  <div className="h-8 w-16 animate-pulse rounded bg-gray-700" />
                ) : (
                  <p className="text-3xl font-bold text-white">{stats?.totalDealers ?? 0}</p>
                )}
              </div>
              <div className="rounded-lg bg-purple-500/10 p-3">
                <ArchiveIcon className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </div>

          {/* Last Scraping */}
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-400">{t('last_scraping')}</p>
                {loading ? (
                  <div className="h-8 w-24 animate-pulse rounded bg-gray-700" />
                ) : (
                  <p className="text-lg font-bold text-white">
                    {formatDate(stats?.lastScrapingAt ?? null)}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-orange-500/10 p-3">
                <Clock className="h-6 w-6 text-orange-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Scraping Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">{t('mobilebg_scraping')}</h2>
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-3">
                  {ownDealers.length > 0
                    ? `${t('ready_to_scrape')} ${ownDealers.length} ${t('own_dealers')}: ${ownDealers.map(d => d.name).join(', ')}`
                    : t('no_dealers_configured')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/config"
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                >
                  <Play className="h-4 w-4" />
                  {t('start_scraping')}
                </Link>
                <p className="text-xs text-gray-500">
                  {t('go_to_config_to_scrape')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">{t('quick_links')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {navigationLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'group relative overflow-hidden rounded-lg border border-gray-700 bg-gray-800 p-6',
                    'transition-all duration-200 hover:border-gray-600 hover:bg-gray-750',
                  )}
                >
                  {/* Hover gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 transition-all duration-200 group-hover:from-blue-500/5 group-hover:to-purple-500/5" />
                  
                  <div className="relative space-y-3">
                    <div className="flex items-center justify-between">
                      <Icon className="h-6 w-6 text-gray-400 transition-colors group-hover:text-blue-400" />
                      <div className="h-1 w-0 transition-all duration-200 rounded bg-blue-400 group-hover:w-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-white transition-colors group-hover:text-blue-300">
                        {link.label}
                      </h3>
                      <p className="text-sm text-gray-500 transition-colors group-hover:text-gray-400">
                        {link.description}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
