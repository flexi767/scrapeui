
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requirePagePermission } from '@/lib/api/auth-helpers';
import { getMobileBgCrawlRuns, getMobileBgDashboardSummary, getMobileBgDealers, getMobileBgEditForms, getMobileBgRepostJobs } from '@/lib/queries';
import { formatDate } from '@/lib/utils';
import { MobileBgActionPanel } from '@/components/MobileBgActionPanel';
import { getTranslations } from 'next-intl/server';

export default async function MobileBgPage() {
  const pageAccess = await requirePagePermission('mobilebg');
  if ('redirect' in pageAccess) redirect(pageAccess.redirect);

  const t = await getTranslations('ui');
  const summary = getMobileBgDashboardSummary();
  const runs = getMobileBgCrawlRuns(8);
  const editForms = getMobileBgEditForms(8);
  const reposts = getMobileBgRepostJobs(8);
  const dealers = getMobileBgDealers();

  const cards = [
    { label: t('crawl_runs'), value: summary.crawlRuns },
    { label: t('draft_listings'), value: summary.backups },
    { label: t('edit_form_snapshots'), value: summary.editForms },
    { label: t('repost_jobs'), value: summary.repostJobs },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('mobilebg_title')}</h1>
        <p className="mt-1 text-sm text-gray-400">
          {t('mobilebg_description')}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{card.value}</div>
          </div>
        ))}
      </div>

      <MobileBgActionPanel
        dealers={dealers.map((dealer) => ({ slug: dealer.slug, name: dealer.name }))}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-lg border border-gray-700 bg-gray-900/40">
          <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
            <h2 className="text-sm font-medium text-gray-200">{t('recent_crawl_runs')}</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {runs.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">{t('no_crawl_runs_yet')}</div>
            ) : runs.map((run) => (
              <div key={run.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-white">{run.dealer_name ?? t('unknown_dealer')}</div>
                  <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[11px] text-gray-300">{run.status}</span>
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {run.listings_count} listings
                  {run.images_downloaded > 0 && ` • ${run.images_downloaded} images`}
                  {' • '}{formatDate(run.started_at || run.created_at)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-700 bg-gray-900/40">
          <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
            <h2 className="text-sm font-medium text-gray-200">{t('recent_edit_forms')}</h2>
            <Link href="/mobilebg/edit-forms" className="text-xs text-blue-300 hover:text-blue-200">{t('open_edit_forms')}</Link>
          </div>
          <div className="divide-y divide-gray-800">
            {editForms.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">{t('no_edit_form_snapshots_yet')}</div>
            ) : editForms.map((entry) => (
              <Link key={entry.id} href={`/mobilebg/edit-forms/${entry.id}`} className="block px-4 py-3 text-sm hover:bg-gray-800/40">
                <div className="font-medium text-white">{entry.row_title || entry.mobile_id || `Snapshot #${entry.id}`}</div>
                <div className="mt-1 text-xs text-gray-400">{entry.dealer_name ?? t('unknown_dealer')} • {formatDate(entry.created_at)}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-700 bg-gray-900/40">
          <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
            <h2 className="text-sm font-medium text-gray-200">{t('recent_reposts')}</h2>
            <Link href="/mobilebg/reposts" className="text-xs text-blue-300 hover:text-blue-200">{t('open_reposts')}</Link>
          </div>
          <div className="divide-y divide-gray-800">
            {reposts.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">{t('no_repost_jobs_yet')}</div>
            ) : reposts.map((job) => (
              <div key={job.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-white">{job.backup_title || job.source_mobile_id || `Job #${job.id}`}</div>
                  <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[11px] text-gray-300">{job.status}</span>
                </div>
                <div className="mt-1 text-xs text-gray-400">{job.dealer_name ?? t('unknown_dealer')} • {formatDate(job.created_at)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
