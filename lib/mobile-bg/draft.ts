import type { Page } from 'playwright';
import { getMobileBgVatLabel } from '@/lib/vat';

export interface MobileBgDraftBackupRow {
  title: string | null;
  source_title: string | null;
  price_amount: number | null;
  vat_included: string | null;
  mileage: number | null;
  fuel: string | null;
  power: number | null;
  engine: string | null;
  color: string | null;
  transmission: string | null;
  body_type?: string | null;
  description: string | null;
  tech_data_json?: string | null;
}

export function buildBackupFieldOverrides(backup: MobileBgDraftBackupRow): Record<string, string | number | null> {
  const engineMatch = backup.engine?.match(/(\d{3,5})/);
  let techData: Record<string, string> = {};
  try {
    techData = backup.tech_data_json ? JSON.parse(backup.tech_data_json) as Record<string, string> : {};
  } catch {
    techData = {};
  }

  return {
    f7: backup.title || backup.source_title || null,
    f8: backup.fuel || null,
    f9: backup.power ?? null,
    f10: backup.transmission || null,
    f11: backup.body_type || null,
    f12: backup.price_amount ?? null,
    f16: backup.mileage ?? null,
    f17: backup.color || null,
    f21: backup.description || null,
    f30: engineMatch?.[1] || null,
    f31: getMobileBgVatLabel(backup.vat_included),
    f13: techData.f13 || null,
    f14: techData.f14 || null,
    f15: techData.f15 || null,
    f22: techData.f22 || null,
    f23: techData.f23 || null,
    f24: techData.f24 || null,
    f25: techData.f25 || null,
    f29: techData.f29 || null,
    f32: techData.f32 || null,
    f33: techData.f33 || null,
    f34: techData.f34 || null,
    priceneg: techData.priceneg || null,
  };
}

export async function selectMobileBgDependentFields(
  page: Page,
  fields: Array<Record<string, unknown>>,
): Promise<void> {
  const selectAndMaybeSubmit = async (fieldName: string, fieldValue: string, submitForm: boolean) => {
    await page.evaluate(({ fieldName: name, fieldValue: value, submitForm: submit }) => {
      const el = document.querySelector(`[name="${name}"]`) as HTMLSelectElement | null;
      if (!el) return;
      const opt = Array.from(el.options).find((option) =>
        String(option.value) === String(value) || option.textContent?.trim() === String(value),
      );
      if (!opt) return;
      el.value = opt.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (submit) {
        const form = (document as Document & { pub?: HTMLFormElement }).pub;
        form?.submit();
      }
    }, { fieldName, fieldValue, submitForm });
    if (submitForm) {
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
    }
  };

  const brandField = fields.find((field) => field.name === 'f5' && field.value) as { value?: string } | undefined;
  const modelField = fields.find((field) => field.name === 'f6' && field.value) as { value?: string } | undefined;
  const regionField = fields.find((field) => field.name === 'f18' && field.value) as { value?: string } | undefined;
  const cityField = fields.find((field) => field.name === 'f19' && field.value) as { value?: string } | undefined;

  if (brandField?.value) await selectAndMaybeSubmit('f5', brandField.value, true);
  if (modelField?.value) await selectAndMaybeSubmit('f6', modelField.value, false);
  if (regionField?.value) await selectAndMaybeSubmit('f18', regionField.value, true);
  if (cityField?.value) await selectAndMaybeSubmit('f19', cityField.value, false);
}

export async function applyCapturedMobileBgDraft(
  page: Page,
  capturedFields: Array<Record<string, unknown>>,
  checkedBoxes: string[],
  fieldOverrides: Record<string, string | number | null>,
): Promise<void> {
  await page.evaluate(({ capturedFields: fields, capturedCheckboxes, overrides }) => {
    const checkboxSet = new Set(capturedCheckboxes);
    const skip = new Set(['f5', 'f6', 'f18', 'f19']);
    const editable = fields.filter((field: Record<string, unknown>) =>
      field.name && !skip.has(String(field.name)) && !['hidden', 'file'].includes(String(field.type || '')),
    );

    for (const field of editable) {
      const element = document.querySelector(`[name="${String(field.name)}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      if (!element) continue;
      const overrideValue = overrides[String(field.name)];
      const effectiveValue = overrideValue ?? field.value;

      if (field.tag === 'select') {
        const select = element as HTMLSelectElement;
        const option = Array.from(select.options).find((opt) =>
          String(opt.value) === String(effectiveValue) || opt.textContent?.trim() === String(effectiveValue),
        );
        if (option) {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        continue;
      }

      if (field.type === 'checkbox') {
        const input = element as HTMLInputElement;
        const shouldCheck = overrideValue != null
          ? String(overrideValue) === String(field.value) || String(overrideValue) === 'true'
          : checkboxSet.has(`${String(field.name)}::${String(field.value)}`);
        input.checked = shouldCheck;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        continue;
      }

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = String(effectiveValue ?? '');
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }, {
    capturedFields,
    capturedCheckboxes: checkedBoxes,
    overrides: fieldOverrides,
  });
}
