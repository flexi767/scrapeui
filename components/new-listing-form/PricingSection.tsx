import { CheckboxField, FormSection, InputField, SelectField } from "@/components/new-listing-form/ui";
import {
  CURRENCY_OPTIONS,
  MONTH_OPTIONS,
  PRODUCTION_YEAR_OPTIONS,
  type FormState,
} from "@/components/new-listing-form/constants";

type SetFormField = <K extends keyof FormState>(
  key: K,
  value: FormState[K],
) => void;

export function PricingSection({
  form,
  setField,
}: {
  form: FormState;
  setField: SetFormField;
}) {
  return (
    <FormSection>
      <div className="grid gap-4 xl:grid-cols-[80px_1.8fr_90px_100px_130px_110px]">
        <InputField
          label="Цена"
          value={form.price}
          onChange={(value) => setField("price", value)}
          type="number"
          maxLength={7}
          accent
        />
        <SelectField
          label="ДДС"
          value={form.vat}
          onChange={(value) => setField("vat", value)}
          options={[
            "",
            "Частна продажба. / Освободена от ДДС продажба.",
            "Цената е с включено ДДС",
            "Цената е без ДДС",
          ]}
          accent
        />
        <SelectField
          label="Валута"
          value={form.currency}
          onChange={(value) => setField("currency", value)}
          options={CURRENCY_OPTIONS}
          accent
        />
        <InputField
          label="Пробег [км]"
          value={form.mileage}
          onChange={(value) => setField("mileage", value)}
          type="number"
          maxLength={7}
          accent
        />
        <SelectField
          label="Месец"
          value={form.productionMonth}
          onChange={(value) => setField("productionMonth", value)}
          options={MONTH_OPTIONS}
          accent
        />
        <SelectField
          label="Година"
          value={form.productionYear}
          onChange={(value) => setField("productionYear", value)}
          options={PRODUCTION_YEAR_OPTIONS}
          accent
        />
      </div>
      <div className="mt-3">
        <CheckboxField
          label="Цена само при запитване"
          checked={form.priceOnRequest}
          onChange={(checked) => setField("priceOnRequest", checked)}
        />
      </div>
    </FormSection>
  );
}
