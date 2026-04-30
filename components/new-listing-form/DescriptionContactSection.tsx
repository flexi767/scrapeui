import {
  FieldLabel,
  FormSection,
  InputField,
} from "@/components/new-listing-form/fields";
import type { FormState } from "@/components/new-listing-form/constants";

type SetFormField = <K extends keyof FormState>(
  key: K,
  value: FormState[K],
) => void;

export function DescriptionContactSection({
  form,
  setField,
}: {
  form: FormState;
  setField: SetFormField;
}) {
  return (
    <FormSection title="Описание И Контакт">
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <FieldLabel>Допълнителна информация</FieldLabel>
          <textarea
            value={form.description}
            onChange={(event) => setField("description", event.target.value)}
            rows={10}
            maxLength={11000}
            className="mt-2 w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <h3 className="mb-4 text-sm font-semibold text-white">
            Данни за обратна връзка
          </h3>
          <div className="space-y-4">
            <InputField
              label="Мобилен телефон"
              value={form.phone}
              onChange={(value) => setField("phone", value)}
              maxLength={14}
              accent
            />
            <InputField
              label="Електронна поща"
              value={form.email}
              onChange={(value) => setField("email", value)}
              maxLength={40}
              accent
            />
            <InputField
              label="http://"
              value={form.website}
              onChange={(value) => setField("website", value)}
              maxLength={40}
            />
          </div>
          <p className="mt-6 text-xs text-sky-300">
            Оцветените в синьо полета са задължителни в Mobile.bg.
          </p>
        </div>
      </div>
    </FormSection>
  );
}
