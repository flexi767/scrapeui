'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

const navigationLinks = [
  { href: '/listings', label: 'Listings', icon: CarFront, description: 'Browse all car listings' },
  { href: '/editown', label: 'Edit Own', icon: EditIcon, description: 'Manage your listings' },
  { href: '/mobilebg', label: 'Mobile.bg', icon: ArchiveIcon, description: 'Mobile.bg integrations' },
  { href: '/mapping', label: 'Mapping', icon: MapIcon, description: 'Brand & model mapping' },
  { href: '/tasks', label: 'Tasks', icon: ListTodo, description: 'Task management' },
  { href: '/kb', label: 'Knowledge Base', icon: BookIcon, description: 'Documentation' },
  { href: '/config', label: 'Configuration', icon: SettingsIcon, description: 'System settings' },
];

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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, dealersRes] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/dealers'),
        ]);
        const statsData = await statsRes.json();
        const dealersData = await dealersRes.json();
        setStats(statsData);
        setDealers(dealersData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const activeDealers = dealers.filter(d => d.active);
  const ownDealers = activeDealers.filter(d => d.own);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-8 p-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400">Project overview and quick links</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Listings */}
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-400">Total Listings</p>
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
                <p className="text-sm font-medium text-gray-400">Active Listings</p>
                {loading ? (
                  <div className="h-8 w-16 animate-pulse rounded bg-gray-700" />
                ) : (
                  <>
                    <p className="text-3xl font-bold text-white">{stats?.activeListings ?? 0}</p>
                    {stats && (
                      <p className="text-xs text-gray-500">
                        {((stats.activeListings / stats.totalListings) * 100).toFixed(0)}% of total
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
                <p className="text-sm font-medium text-gray-400">Active Dealers</p>
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
                <p className="text-sm font-medium text-gray-400">Last Scraping</p>
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
          <h2 className="text-xl font-bold text-white">Mobile.bg Scraping</h2>
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-3">
                  {ownDealers.length > 0
                    ? `Ready to scrape ${ownDealers.length} own dealer(s): ${ownDealers.map(d => d.name).join(', ')}`
                    : 'No dealers configured for scraping'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/config"
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                >
                  <Play className="h-4 w-4" />
                  Start Scraping
                </Link>
                <p className="text-xs text-gray-500">
                  Go to Configuration to select dealers and run the scraper
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Quick Links</h2>
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
