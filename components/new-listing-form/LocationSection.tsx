import type { City, Region } from "@/lib/mobile-bg/regions";
import {
  FormSection,
  InputField,
  SelectField,
} from "@/components/new-listing-form/fields";
import { COLOR_OPTIONS, type FormState } from "@/components/new-listing-form/constants";

type SetFormField = <K extends keyof FormState>(
  key: K,
  value: FormState[K],
) => void;

export function LocationSection({
  form,
  regions,
  cities,
  citiesLoading,
  setField,
  onRegionChange,
}: {
  form: FormState;
  regions: Region[];
  cities: City[];
  citiesLoading: boolean;
  setField: SetFormField;
  onRegionChange: (regionValue: string) => void | Promise<void>;
}) {
  return (
    <FormSection>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr_1.1fr]">
        <SelectField
          label="Цвят"
          value={form.color}
          onChange={(value) => setField("color", value)}
          options={COLOR_OPTIONS}
        />
        <SelectField
          label="Намира се в"
          value={form.region}
          onChange={onRegionChange}
          options={[
            "",
            ...regions.map(
              (region) =>
                ({ value: region.value, label: region.label }) as const,
            ),
          ]}
          accent
        />
        <SelectField
          label="Град"
          value={form.city}
          onChange={(value) => setField("city", value)}
          options={[
            "",
            ...cities.map(
              (city) => ({ value: city.value, label: city.label }) as const,
            ),
          ]}
          accent
          disabled={!form.region || citiesLoading}
        />
        <InputField
          label="VIN номер"
          value={form.vin}
          onChange={(value) => setField("vin", value)}
          maxLength={17}
        />
      </div>
    </FormSection>
  );
}
