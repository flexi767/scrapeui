import { buildBackupFieldOverrides } from '@/lib/mobile-bg/draft';
import type { BackupRow } from '@/lib/mobile-bg/repost-types';
import { parseJson } from '@/lib/utils';

export function getPrimaryPubtype(techDataJson: string | null): string {
  const parsed = parseJson<Record<string, string>>(techDataJson, {});
  const raw = parsed.pubtype || '1';
  return raw.split(',').map((part) => part.trim()).find(Boolean) || '1';
}

export function getRegionCityValues(techDataJson: string | null): { region: string | null; city: string | null } {
  const parsed = parseJson<Record<string, string>>(techDataJson, {});
  return {
    region: parsed.region || null,
    city: parsed.city || null,
  };
}

export function buildDraftPublishFields(backup: BackupRow) {
  const { region, city } = getRegionCityValues(backup.tech_data_json);
  const fieldOverrides = buildBackupFieldOverrides(backup);
  const dependentFields = [
    { name: 'f5', value: backup.make || '' },
    { name: 'f6', value: backup.model || '' },
    { name: 'f18', value: region || '' },
    { name: 'f19', value: city || '' },
  ].filter((field) => field.value);
  const editableFields = [
    { tag: 'input', type: 'text', name: 'f7', value: fieldOverrides.f7 ? String(fieldOverrides.f7) : '' },
    { tag: 'select', name: 'f8', value: fieldOverrides.f8 ? String(fieldOverrides.f8) : '' },
    { tag: 'input', type: 'text', name: 'f9', value: fieldOverrides.f9 != null ? String(fieldOverrides.f9) : '' },
    { tag: 'select', name: 'f29', value: fieldOverrides.f29 ? String(fieldOverrides.f29) : '' },
    { tag: 'select', name: 'f10', value: fieldOverrides.f10 ? String(fieldOverrides.f10) : '' },
    { tag: 'select', name: 'f11', value: fieldOverrides.f11 ? String(fieldOverrides.f11) : '' },
    { tag: 'input', type: 'text', name: 'f12', value: fieldOverrides.f12 != null ? String(fieldOverrides.f12) : '' },
    { tag: 'select', name: 'f13', value: fieldOverrides.f13 ? String(fieldOverrides.f13) : '' },
    { tag: 'select', name: 'f14', value: fieldOverrides.f14 ? String(fieldOverrides.f14) : '' },
    { tag: 'select', name: 'f15', value: fieldOverrides.f15 ? String(fieldOverrides.f15) : '' },
    { tag: 'input', type: 'text', name: 'f16', value: fieldOverrides.f16 != null ? String(fieldOverrides.f16) : '' },
    { tag: 'select', name: 'f17', value: fieldOverrides.f17 ? String(fieldOverrides.f17) : '' },
    { tag: 'textarea', type: 'textarea', name: 'f21', value: fieldOverrides.f21 ? String(fieldOverrides.f21) : '' },
    { tag: 'input', type: 'text', name: 'f22', value: fieldOverrides.f22 ? String(fieldOverrides.f22) : '' },
    { tag: 'input', type: 'text', name: 'f23', value: fieldOverrides.f23 ? String(fieldOverrides.f23) : '' },
    { tag: 'input', type: 'text', name: 'f24', value: fieldOverrides.f24 ? String(fieldOverrides.f24) : '' },
    { tag: 'select', name: 'f25', value: fieldOverrides.f25 ? String(fieldOverrides.f25) : '' },
    { tag: 'input', type: 'text', name: 'f30', value: fieldOverrides.f30 != null ? String(fieldOverrides.f30) : '' },
    { tag: 'select', name: 'f31', value: fieldOverrides.f31 ? String(fieldOverrides.f31) : '' },
    { tag: 'input', type: 'text', name: 'f32', value: fieldOverrides.f32 ? String(fieldOverrides.f32) : '' },
    { tag: 'input', type: 'text', name: 'f33', value: fieldOverrides.f33 ? String(fieldOverrides.f33) : '' },
    { tag: 'input', type: 'text', name: 'f34', value: fieldOverrides.f34 ? String(fieldOverrides.f34) : '' },
    { tag: 'input', type: 'checkbox', name: 'priceneg', value: fieldOverrides.priceneg ? String(fieldOverrides.priceneg) : '' },
  ].filter((field) => field.value);

  return {
    region,
    city,
    fieldOverrides,
    dependentFields,
    editableFields,
    pubtype: getPrimaryPubtype(backup.tech_data_json),
  };
}
