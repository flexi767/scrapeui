export function SyncBadge({ status, error }: { status: string | null; error: string | null }) {
  if (status === 'running') {
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200">running</span>;
  }
  if (status === 'success') {
    return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200">success</span>;
  }
  if (status === 'failed') {
    return (
      <span
        className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-200"
        title={error || 'Sync failed'}
      >
        failed
      </span>
    );
  }
  if (status === 'pending') {
    return <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] text-blue-200">pending</span>;
  }
  return <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[11px] text-gray-400">idle</span>;
}
