import type { Dispatch, SetStateAction } from 'react';
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
  return (
    <div className="rounded-lg border border-gray-700/60 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700 bg-gray-800/60 text-xs uppercase tracking-wider text-gray-400">
            <th className="px-4 py-2 text-left w-40">Name</th>
            <th className="px-4 py-2 text-left">Slug</th>
            <th className="px-4 py-2 text-left">Mobile.bg URL</th>
            <th className="px-4 py-2 text-left">Cars.bg URL</th>
            <th className="px-4 py-2 text-center">Own</th>
            <th className="px-4 py-2 text-center">Priority</th>
            <th className="px-4 py-2 text-center">Active</th>
            <th className="px-4 py-2 text-center">Public</th>
            <th className="px-4 py-2 text-center w-16"></th>
            <th className="px-4 py-2 text-center w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {dealers.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-500">No dealers yet</td></tr>}
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
