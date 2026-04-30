import type { MakeEntry } from "@/lib/mobile-bg/makes-models";
import {
  AutocompleteInput,
  type AutocompleteOption,
} from "@/components/new-listing-form/autocomplete";
import {
  FieldLabel,
  FormSection,
  InputField,
  SelectField,
} from "@/components/new-listing-form/fields";
import {
  BODY_TYPE_OPTIONS,
  CONDITION_OPTIONS,
  EURO_OPTIONS,
  MAIN_CATEGORIES,
  type FormState,
} from "@/components/new-listing-form/constants";

type SetFormField = <K extends keyof FormState>(
  key: K,
  value: FormState[K],
) => void;

export function VehicleDetailsSection({
  form,
  makesLoading,
  makeOptions,
  modelOptions,
  selectedMakeCount,
  selectedModelCount,
  openAutocomplete,
  transmissions,
  fuels,
  showBatteryFields,
  setField,
  onOpenAutocompleteChange,
  onUpdateMake,
  onCategoryChange,
}: {
  form: FormState;
  makesLoading: boolean;
  makeOptions: AutocompleteOption[];
  modelOptions: Array<Pick<MakeEntry["models"][number], "count"> & { value: string }>;
  selectedMakeCount: number | null;
  selectedModelCount: number | null;
  openAutocomplete: "make" | "model" | null;
  transmissions: string[];
  fuels: string[];
  showBatteryFields: boolean;
  setField: SetFormField;
  onOpenAutocompleteChange: (
    updater:
      | "make"
      | "model"
      | null
      | ((current: "make" | "model" | null) => "make" | "model" | null),
  ) => void;
  onUpdateMake: (value: string) => void;
  onCategoryChange: (pubtype: string) => void | Promise<void>;
}) {
  return (
    <FormSection>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_2fr_1fr_1fr]">
        <div className="min-w-0 w-full flex flex-col gap-1 xl:w-56">
          <FieldLabel required>
            {makesLoading ? "Марка (зарежда...)" : "Марка"}
          </FieldLabel>
          <AutocompleteInput
            value={form.make}
            onChange={onUpdateMake}
            options={makeOptions}
            placeholder="Type make"
            emptyLabel="No make matches"
            hideLowCountOnEmpty
            open={openAutocomplete === "make"}
            focusWhenOpen
            trailingText={
              selectedMakeCount != null
                ? selectedMakeCount.toLocaleString("en-US")
                : null
            }
            onOpenChange={(open) => {
              if (open) {
                onOpenAutocompleteChange("make");
                return;
              }
              onOpenAutocompleteChange((current) =>
                current === "make" ? null : current,
              );
            }}
          />
        </div>
        <div className="min-w-0 flex flex-col gap-1 xl:w-56">
          <FieldLabel>Модел</FieldLabel>
          <AutocompleteInput
            value={form.model}
            onChange={(value) => setField("model", value)}
            options={modelOptions}
            placeholder="Type model"
            emptyLabel="No model matches"
            open={openAutocomplete === "model"}
            focusWhenOpen
            onArrowLeft={() => onOpenAutocompleteChange("make")}
            trailingText={
              selectedModelCount != null
                ? selectedModelCount.toLocaleString("en-US")
                : null
            }
            onOpenChange={(open) => {
              if (open) {
                onOpenAutocompleteChange("model");
                return;
              }
              onOpenAutocompleteChange((current) =>
                current === "model" ? null : current,
              );
            }}
          />
        </div>
        <div className="min-w-0 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <FieldLabel required>Заглавие</FieldLabel>
            <span className="text-xs text-gray-500">
              {form.title.length}/50
            </span>
          </div>
          <input
            type="text"
            value={form.title}
            onChange={(event) => setField("title", event.target.value)}
            maxLength={50}
            className="h-10 rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="min-w-0 xl:w-28 xl:justify-self-end">
          <SelectField
            label="Двигател"
            value={form.fuel}
            onChange={(value) => setField("fuel", value)}
            options={["", ...fuels.filter(Boolean)]}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_1.1fr_1.1fr_1.1fr]">
        <div className="w-full xl:w-56">
          <InputField
            label="Мощност [к.с.]"
            value={form.power}
            onChange={(value) => setField("power", value)}
            type="number"
            maxLength={4}
          />
        </div>
        <div className="xl:w-56">
          <SelectField
            label="Евростандарт"
            value={form.euronorm}
            onChange={(value) => setField("euronorm", value)}
            options={EURO_OPTIONS}
          />
        </div>
        <SelectField
          label="Кутия"
          value={form.transmission}
          onChange={(value) => setField("transmission", value)}
          options={["", ...transmissions.filter(Boolean)]}
          accent
        />
        <SelectField
          label="Основна"
          value={form.pubtype}
          onChange={onCategoryChange}
          options={MAIN_CATEGORIES.map((item) => ({
            value: item.value,
            label: item.label,
          }))}
          required
        />
        <div className="min-w-0 xl:w-28 xl:justify-self-end">
          <SelectField
            label="Категория"
            value={form.bodyType}
            onChange={(value) => setField("bodyType", value)}
            options={BODY_TYPE_OPTIONS}
            accent
          />
        </div>
      </div>

      <div className="mt-4 flex flex-nowrap gap-4 overflow-x-auto pb-1">
        <div className="w-56 shrink-0">
          <InputField
            label="Кубатура [куб.см]"
            value={form.engineCc}
            onChange={(value) => setField("engineCc", value)}
            type="number"
            maxLength={5}
          />
        </div>
        <div className="w-56 shrink-0">
          <SelectField
            label="Състояние"
            value={form.condition}
            onChange={(value) => setField("condition", value)}
            options={CONDITION_OPTIONS}
          />
        </div>
        {showBatteryFields ? (
          <>
            <div className="w-[15.4rem] shrink-0">
              <InputField
                label="Пробег с едно зареждане (WLTP) [км]"
                value={form.batteryRange}
                onChange={(value) => setField("batteryRange", value)}
                type="number"
                maxLength={4}
                accent
              />
            </div>
            <div className="w-[15.4rem] shrink-0">
              <InputField
                label="Капацитет на батерията [kWh]"
                value={form.batteryCapacity}
                onChange={(value) => setField("batteryCapacity", value)}
                type="number"
                maxLength={7}
                accent
              />
            </div>
          </>
        ) : null}
      </div>
    </FormSection>
  );
}
