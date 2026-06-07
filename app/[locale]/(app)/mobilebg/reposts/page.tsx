
import { getMobileBgRepostJobs } from '@/lib/queries';
import { formatDate } from '@/lib/utils';
import { getTranslations } from 'next-intl/server';

export default async function MobileBgRepostsPage() {
  const t = await getTranslations('ui');
  const jobs = getMobileBgRepostJobs(250);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('mobilebg_reposts_title')}</h1>
        <p className="mt-1 text-sm text-gray-400">
          {t('mobilebg_reposts_description')}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/60 text-xs uppercase tracking-wider text-gray-400">
              <th className="px-4 py-2 text-left">{t('col_source')}</th>
              <th className="px-4 py-2 text-left">{t('col_dealer')}</th>
              <th className="px-4 py-2 text-left">{t('col_status')}</th>
              <th className="px-4 py-2 text-left">{t('col_target_id')}</th>
              <th className="px-4 py-2 text-right">{t('col_started')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500">{t('no_repost_jobs_yet')}</td>
              </tr>
            ) : jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-800/40">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{job.backup_title || job.source_mobile_id || `Job #${job.id}`}</div>
                  <div className="mt-0.5 text-xs text-gray-400">{job.message || '—'}</div>
                </td>
                <td className="px-4 py-3 text-gray-300">{job.dealer_name || '—'}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[11px] text-gray-300">{job.status}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{job.target_mobile_id || '—'}</td>
                <td className="px-4 py-3 text-right text-gray-400">{formatDate(job.started_at || job.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
