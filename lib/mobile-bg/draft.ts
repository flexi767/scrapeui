import type { Page } from 'playwright';

export interface MobileBgDraftBackupRow {
  title: string | null;
  source_title: string | null;
  price_amount: number | null;
  vat_included: number | null;
  mileage: number | null;
  fuel: string | null;
  power: number | null;
  engine: string | null;
  color: string | null;
  transmission: string | null;
  category: string | null;
  description: string | null;
}

export function buildBackupFieldOverrides(backup: MobileBgDraftBackupRow): Record<string, string | number | null> {
  const engineMatch = backup.engine?.match(/(\d{3,5})/);

  return {
    f7: backup.title || backup.source_title || null,
    f8: backup.fuel || null,
    f9: backup.power ?? null,
    f10: backup.transmission || null,
    f11: backup.category || null,
    f12: backup.price_amount ?? null,
    f16: backup.mileage ?? null,
    f17: backup.color || null,
    f21: backup.description || null,
    f30: engineMatch?.[1] || null,
    f31:
      backup.vat_included == null
        ? null
        : backup.vat_included === 1
          ? 'Цената е с включено ДДС'
          : 'Частна продажба. / Освободена от ДДС продажба.',
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

    const setValue = (element: HTMLInputElement | HTMLTextAreaElement, value: unknown) => {
      element.value = String(value ?? '');
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };

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
        input.checked = checkboxSet.has(`${String(field.name)}::${String(field.value)}`);
        input.dispatchEvent(new Event('change', { bubbles: true }));
        continue;
      }

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        setValue(element, effectiveValue);
      }
    }
  }, {
    capturedFields,
    capturedCheckboxes: checkedBoxes,
    overrides: fieldOverrides,
  });
}
