'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { DealerTableRow } from './DealerTableRow';
import type { Dealer, DealerEditForm, DealerLoginResult } from './types';

interface DealersTableProps {
  dealers: Dealer[];
  editingId: number | null;
  editForm: DealerEditForm;
  flashId: number | null;
  loginResults: Record<number, DealerLoginResult>;
  loginRunning: Set<number>;
  saving: boolean;
  setEditForm: Dispatch<SetStateAction<DealerEditForm>>;
  onCancelEdit: () => void;
  onChangePriority: (dealer: Dealer, delta: number) => void;
  onDelete: (dealer: Dealer) => void;
  onSaveEdit: (id: number) => void;
  onStartEdit: (dealer: Dealer) => void;
  onTestLogin: (id: number) => void;
  onToggleActive: (dealer: Dealer) => void;
  onToggleOwn: (dealer: Dealer) => void;
}

export function DealersTable({
  dealers,
  editingId,
  editForm,
  flashId,
  loginResults,
  loginRunning,
  saving,
  setEditForm,
  onCancelEdit,
  onChangePriority,
  onDelete,
  onSaveEdit,
  onStartEdit,
  onTestLogin,
  onToggleActive,
  onToggleOwn,
}: DealersTableProps) {
  const t = useTranslations('ui');

  return (
    <div className="rounded-lg border border-gray-700/60 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700 bg-gray-800/60 text-xs uppercase tracking-wider text-gray-400">
            <th className="px-4 py-2 text-left w-40">{t('name')}</th>
            <th className="px-4 py-2 text-left">{t('slug')}</th>
            <th className="px-4 py-2 text-left">Mobile.bg URL</th>
            <th className="px-4 py-2 text-left">Cars.bg URL</th>
            <th className="px-4 py-2 text-center">{t('own')}</th>
            <th className="px-4 py-2 text-center">{t('priority')}</th>
            <th className="px-4 py-2 text-center">{t('active')}</th>
            <th className="px-4 py-2 text-left">{t('social')}</th>
            <th className="px-4 py-2 text-center">{t('public')}</th>
            <th className="px-4 py-2 text-center w-16"></th>
            <th className="px-4 py-2 text-center w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {dealers.length === 0 && <tr><td colSpan={11} className="px-4 py-6 text-center text-gray-500">{t('no_dealers_yet')}</td></tr>}
          {dealers.map((dealer) => (
            <DealerTableRow
              key={dealer.id}
              dealer={dealer}
              editForm={editForm}
              editing={editingId === dealer.id}
              flashActive={flashId === dealer.id}
              isLoginRunning={loginRunning.has(dealer.id)}
              loginResult={loginResults[dealer.id]}
              saving={saving}
              setEditForm={setEditForm}
              onCancelEdit={onCancelEdit}
              onChangePriority={onChangePriority}
              onDelete={onDelete}
              onSaveEdit={onSaveEdit}
              onStartEdit={onStartEdit}
              onTestLogin={onTestLogin}
              onToggleActive={onToggleActive}
              onToggleOwn={onToggleOwn}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
