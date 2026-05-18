import type { Dispatch, SetStateAction } from 'react';
import { CARS_BG_CREDENTIAL_SECTION, MOBILE_BG_CREDENTIAL_SECTION } from '@/lib/dealers/platformCredentials';
import { SOCIAL_CREDENTIAL_SECTIONS, type SocialCredentialSection } from '@/lib/dealers/socialCredentials';
import { DealerPlatformFields } from './DealerPlatformFields';
import { DealerSocialFields } from './DealerSocialFields';
import { DealerTextInput } from './DealerTextInput';
import { LoginBadge } from './LoginBadge';
import { DEALER_TEMPLATES, type Dealer, type DealerEditForm, type DealerLoginResult, type TemplateName } from './types';
import { slugifyDealerName } from './utils';

const EDIT_INPUT_CLASS_NAME =
  'w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none';

function socialLabel(section: SocialCredentialSection, dealer: Dealer) {
  const userField = section.fields.find((field) => field.type !== 'password');
  const passwordField = section.fields.find((field) => field.type === 'password');
  const user = userField ? dealer[userField.key] : null;
  const password = passwordField ? dealer[passwordField.key] : null;

  if (!user && !password) return null;
  return (
    <div key={section.title} className="truncate text-[11px] text-gray-300">
      <span className="text-gray-500">{section.shortLabel}:</span> {user || 'saved'}
    </div>
  );
}

function hasSocialCredentials(dealer: Dealer) {
  return SOCIAL_CREDENTIAL_SECTIONS.some((section) =>
    section.fields.some((field) => dealer[field.key]),
  );
}

interface DealerTableRowProps {
  dealer: Dealer;
  editForm: DealerEditForm;
  editing: boolean;
  flashActive: boolean;
  isLoginRunning: boolean;
  loginResult: DealerLoginResult | undefined;
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

export function DealerTableRow({
  dealer,
  editForm,
  editing,
  flashActive,
  isLoginRunning,
  loginResult,
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
}: DealerTableRowProps) {
  return (
    <tr className={`align-top transition-colors duration-500 ${flashActive ? 'bg-blue-900/40' : 'hover:bg-gray-800/40'}`}>
      <td className="px-4 py-2 text-white">
        {editing ? (
          <DealerTextInput
            value={editForm.name}
            onValueChange={(value) =>
              setEditForm((current) => ({ ...current, name: value }))
            }
            className={EDIT_INPUT_CLASS_NAME}
          />
        ) : (
          <button onClick={() => onStartEdit(dealer)} className="text-left text-white hover:text-blue-300">{dealer.name}</button>
        )}
      </td>
      <td className="px-4 py-2 text-gray-400 font-mono text-xs">
        {editing ? (
          <DealerTextInput
            value={editForm.slug}
            onValueChange={(value) =>
              setEditForm((current) => ({
                ...current,
                slug: slugifyDealerName(value),
              }))
            }
            className={`${EDIT_INPUT_CLASS_NAME} font-mono`}
          />
        ) : (
          <button onClick={() => onStartEdit(dealer)} className="text-left font-mono text-xs text-gray-400 hover:text-blue-300">{dealer.slug}</button>
        )}
      </td>
      <td className="px-4 py-2">
        {editing ? (
          <div className="space-y-2">
            <DealerPlatformFields
              form={editForm}
              showCredentials={editForm.own}
              section={MOBILE_BG_CREDENTIAL_SECTION}
              onChange={setEditForm}
              className={EDIT_INPUT_CLASS_NAME}
            />
          </div>
        ) : dealer.mobile_url ? (
          <a href={dealer.mobile_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs truncate block max-w-[220px]">
            {dealer.mobile_url}
          </a>
        ) : null}
      </td>
      <td className="px-4 py-2">
        {editing ? (
          <div className="space-y-2">
            <DealerPlatformFields
              form={editForm}
              showCredentials={editForm.own}
              section={CARS_BG_CREDENTIAL_SECTION}
              onChange={setEditForm}
              className={EDIT_INPUT_CLASS_NAME}
            />
          </div>
        ) : dealer.cars_url ? (
          <a href={dealer.cars_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs truncate block max-w-[220px]">
            {dealer.cars_url}
          </a>
        ) : null}
      </td>
      <td className="px-4 py-2 text-center">
        <button onClick={() => onToggleOwn(dealer)} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${dealer.own ? 'bg-emerald-800/70 text-emerald-200' : 'bg-gray-700 text-gray-400'}`}>{dealer.own ? 'yes' : 'no'}</button>
      </td>
      <td className="px-4 py-2 text-center">
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => onChangePriority(dealer, -1)} className="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:text-white hover:bg-gray-700">−</button>
          <span className="w-6 text-center text-sm text-gray-300">{dealer.priority || 0}</span>
          <button onClick={() => onChangePriority(dealer, 1)} className="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:text-white hover:bg-gray-700">+</button>
        </div>
        {editing && dealer.own === 1 && (
          <div className="mt-1.5 flex justify-center">
            {isLoginRunning ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
            ) : (
              <LoginBadge result={loginResult?.['mobile.bg']} label="mobile" />
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-2 text-center">
        <button onClick={() => onToggleActive(dealer)} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${dealer.active ? 'bg-green-800/70 text-green-200' : 'bg-gray-700 text-gray-400'}`}>{dealer.active ? 'on' : 'off'}</button>
        {editing && dealer.own === 1 && (
          <div className="mt-1.5 flex justify-center">
            {isLoginRunning ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
            ) : (
              <LoginBadge result={loginResult?.['cars.bg']} label="cars" />
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-2 align-top">
        {editing ? (
          editForm.own ? (
            <div className="grid min-w-[260px] grid-cols-2 gap-1.5">
              <DealerSocialFields
                form={editForm}
                onChange={setEditForm}
                className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          ) : (
            <span className="text-xs text-gray-500">own dealer only</span>
          )
        ) : (
          <div className="max-w-[180px] space-y-0.5">
            {SOCIAL_CREDENTIAL_SECTIONS.map((section) => socialLabel(section, dealer))}
            {!hasSocialCredentials(dealer) && <span className="text-xs text-gray-600">-</span>}
          </div>
        )}
      </td>
      <td className="px-4 py-2 text-center align-top">
        {editing ? (
          <div className="flex flex-col gap-1.5 items-start min-w-[160px]">
            <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
              <input type="checkbox" checked={editForm.public_enabled} onChange={e => setEditForm(f => ({ ...f, public_enabled: e.target.checked }))} />
              Enabled
            </label>
            <select value={editForm.template} onChange={e => setEditForm(f => ({ ...f, template: e.target.value as TemplateName }))} className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none">
              {DEALER_TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <DealerTextInput
              value={editForm.public_domain}
              onValueChange={(value) =>
                setEditForm((current) => ({ ...current, public_domain: value }))
              }
              placeholder="www.example.com"
              className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${dealer.public_enabled === 1 ? 'bg-purple-800/70 text-purple-200' : 'bg-gray-700 text-gray-500'}`}>
              {dealer.public_enabled === 1 ? dealer.template : 'off'}
            </span>
            {dealer.public_enabled === 1 && (
              <a href={`/d/${dealer.slug}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-purple-400 hover:underline font-mono">
                /d/{dealer.slug}
              </a>
            )}
            {dealer.active_template_config_id != null ? (
              <a href={`/templates/editor/${dealer.active_template_config_id}`} className="text-[10px] text-blue-400 hover:underline">
                custom tmpl #{dealer.active_template_config_id}
              </a>
            ) : dealer.public_enabled === 1 ? (
              <a href="/templates" className="text-[10px] text-gray-500 hover:text-gray-300">
                + add template
              </a>
            ) : null}
          </div>
        )}
      </td>
      <td className="px-4 py-2 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <button onClick={() => onSaveEdit(dealer.id)} disabled={saving} title="Save" className={`text-emerald-400 hover:text-emerald-300 disabled:opacity-50 ${editing ? '' : 'invisible'}`}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>
          {editing ? (
            <button onClick={onCancelEdit} title="Cancel" className="text-gray-400 hover:text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button onClick={() => onStartEdit(dealer)} title="Edit" className="text-gray-400 hover:text-blue-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
              </svg>
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-2 text-center">
        <button onClick={() => onDelete(dealer)} title="Delete" className="text-gray-600 hover:text-red-400">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 011-1h4a1 1 0 011 1m-7 0H5m14 0h-2" />
          </svg>
        </button>
        {editing && dealer.own === 1 && (
          <button
            onClick={() => onTestLogin(dealer.id)}
            disabled={isLoginRunning}
            title="Test logins"
            className="mt-1.5 block w-full text-center text-[10px] text-gray-500 hover:text-blue-400 disabled:opacity-40"
          >
            {isLoginRunning ? '…' : 'test'}
          </button>
        )}
      </td>
    </tr>
  );
}
