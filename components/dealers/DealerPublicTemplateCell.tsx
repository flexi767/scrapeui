'use client';

import Link from 'next/link';
import type { Dispatch, SetStateAction } from 'react';
import { DealerTextInput } from './DealerTextInput';
import { DEALER_TEMPLATES, type Dealer, type DealerEditForm, type TemplateName } from './types';

interface DealerPublicTemplateCellProps {
  dealer: Dealer;
  editForm: DealerEditForm;
  editing: boolean;
  enabledLabel: string;
  addTemplateLabel: string;
  setEditForm: Dispatch<SetStateAction<DealerEditForm>>;
}

export function DealerPublicTemplateCell({
  dealer,
  editForm,
  editing,
  enabledLabel,
  addTemplateLabel,
  setEditForm,
}: DealerPublicTemplateCellProps) {
  if (editing) {
    return (
      <div className="flex min-w-[160px] flex-col items-start gap-1.5">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={editForm.public_enabled}
            onChange={(event) =>
              setEditForm((current) => ({ ...current, public_enabled: event.target.checked }))
            }
          />
          {enabledLabel}
        </label>
        <select
          value={editForm.template}
          onChange={(event) =>
            setEditForm((current) => ({
              ...current,
              template: event.target.value as TemplateName,
            }))
          }
          className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
        >
          {DEALER_TEMPLATES.map((template) => (
            <option key={template} value={template}>{template}</option>
          ))}
        </select>
        <DealerTextInput
          value={editForm.public_domain}
          onValueChange={(value) =>
            setEditForm((current) => ({ ...current, public_domain: value }))
          }
          placeholder="www.example.com"
          className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 font-mono text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${dealer.public_enabled === 1 ? 'bg-purple-800/70 text-purple-200' : 'bg-gray-700 text-gray-500'}`}>
        {dealer.public_enabled === 1 ? dealer.template : 'off'}
      </span>
      {dealer.public_enabled === 1 && (
        <a href={`/d/${dealer.slug}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-purple-400 hover:underline">
          /d/{dealer.slug}
        </a>
      )}
      {dealer.active_template_config_id != null ? (
        <a href={`/templates/editor/${dealer.active_template_config_id}`} className="text-[10px] text-blue-400 hover:underline">
          custom tmpl #{dealer.active_template_config_id}
        </a>
      ) : dealer.public_enabled === 1 ? (
        <Link href="/templates" className="text-[10px] text-gray-500 hover:text-gray-300">
          {addTemplateLabel}
        </Link>
      ) : null}
    </div>
  );
}
