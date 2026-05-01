import type { LoginResult } from './types';

export function LoginBadge({ result, label }: { result?: LoginResult; label: string }) {
  if (!result) return <span className="text-gray-600 text-[10px]">{label} —</span>;
  if (result.ok) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-800/60 px-1.5 py-px text-[10px] font-semibold text-emerald-300">
        ✓ {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-900/60 px-1.5 py-px text-[10px] font-semibold text-red-300" title={result.reason}>
      ✗ {label}
    </span>
  );
}
