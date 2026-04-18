# NewListingForm Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `NewListingForm.tsx` to match the mobile.bg create-listing field layout exactly.

**Architecture:** Three isolated JSX edits to a single component file — add a missing field, flatten a nested layout, and restructure a grid. No new state, props, or API changes required.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS v4, TypeScript strict

---

## Files

- Modify: `components/NewListingForm.tsx`

---

### Task 1: Add Fuel (Двигател) field to Row 1

The `fuel` field exists in `FormState` and the `fuels` prop is already passed to the component but the field is never rendered.

**Files:**
- Modify: `components/NewListingForm.tsx`

- [ ] **Step 1: Locate Row 1 grid**

Find this block (around line 1130):
```tsx
<div className="grid gap-4 xl:grid-cols-[1.1fr_1.1fr_1fr_1fr_1fr]">
  <SelectField label="Основна категория" ... />
  <div className="min-w-0 flex flex-col gap-1">
    <FieldLabel required>...</FieldLabel>
    <AutocompleteInput value={form.make} ... />
  </div>
  <div className="min-w-0 flex flex-col gap-1">
    <FieldLabel>Модел</FieldLabel>
    <AutocompleteInput value={form.model} ... />
  </div>
  <InputField label="Заглавие" ... />
  <SelectField label="Състояние" ... />
</div>
```

- [ ] **Step 2: Add the Fuel SelectField and expand the grid**

Replace the opening `<div className="grid ...">` and add the fuel field between Заглавие and Състояние:

```tsx
<div className="grid gap-4 xl:grid-cols-[1.1fr_1.1fr_1fr_1fr_1fr_1fr]">
  <SelectField
    label="Основна категория"
    value={form.pubtype}
    onChange={onCategoryChange}
    options={MAIN_CATEGORIES.map((item) => ({
      value: item.value,
      label: item.label,
    }))}
    required
  />
  <div className="min-w-0 flex flex-col gap-1">
    <FieldLabel required>
      {makesLoading ? "Марка (зарежда...)" : "Марка"}
    </FieldLabel>
    <AutocompleteInput
      value={form.make}
      onChange={updateMake}
      options={makeOptions}
      placeholder="Type make"
      emptyLabel="No make matches"
      hideLowCountOnEmpty
      open={openAutocomplete === "make"}
      trailingText={
        selectedMakeCount != null
          ? selectedMakeCount.toLocaleString("en-US")
          : null
      }
      onOpenChange={(open) => {
        if (open) {
          setOpenAutocomplete("make");
          return;
        }
        setOpenAutocomplete((current) =>
          current === "make" ? null : current,
        );
      }}
    />
  </div>
  <div className="min-w-0 flex flex-col gap-1">
    <FieldLabel>Модел</FieldLabel>
    <AutocompleteInput
      value={form.model}
      onChange={(value) => setField("model", value)}
      options={modelOptions}
      placeholder="Type model"
      emptyLabel="No model matches"
      open={openAutocomplete === "model"}
      focusWhenOpen
      trailingText={
        selectedModelCount != null
          ? selectedModelCount.toLocaleString("en-US")
          : null
      }
      onOpenChange={(open) => {
        if (open) {
          setOpenAutocomplete("model");
          return;
        }
        setOpenAutocomplete((current) =>
          current === "model" ? null : current,
        );
      }}
    />
  </div>
  <InputField
    label="Заглавие"
    value={form.title}
    onChange={(value) => setField("title", value)}
    maxLength={50}
  />
  <SelectField
    label="Двигател"
    value={form.fuel}
    onChange={(value) => setField("fuel", value)}
    options={["", ...fuels.filter(Boolean)]}
    accent
  />
  <SelectField
    label="Състояние"
    value={form.condition}
    onChange={(value) => setField("condition", value)}
    options={CONDITION_OPTIONS}
  />
</div>
```

- [ ] **Step 3: Verify `fuels` is destructured from props**

At the top of the component function confirm (around line 834):
```tsx
export default function NewListingForm({
  makes: initialMakes,
  fuels,
  transmissions,
  regions,
  dealers,
  initialDealerListingsByDealer,
}: Props) {
```
`fuels` is already destructured — no change needed.

- [ ] **Step 4: Start dev server and visually verify**

```bash
npm run dev
```

Open `http://localhost:3000` and navigate to New Listing. Confirm Row 1 shows six fields: Основна категория | Марка | Модел | Заглавие | **Двигател** | Състояние.

- [ ] **Step 5: Commit**

```bash
git add components/NewListingForm.tsx
git commit -m "feat: add missing Двигател field to new listing form row 1"
```

---

### Task 2: Flatten the price/production section

Currently three nested `rounded-xl` sub-boxes. Replace with one flat grid row.

**Files:**
- Modify: `components/NewListingForm.tsx`

- [ ] **Step 1: Locate the price section (around line 1268)**

Find the `<FormSection title="Цена И Производство">` block. It currently contains:
```tsx
<div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
  <div className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
    <div className="grid gap-4 md:grid-cols-[90px_1fr_90px]">
      <InputField label="Цена" ... />
      <SelectField label="ДДС" ... />
      <SelectField label="Валута" ... />
    </div>
    <div className="mt-4">
      <CheckboxField label="Цена само при запитване" ... />
    </div>
  </div>
  <InputField label="Пробег [км]" ... />
  <div className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
    <div className="grid gap-4 md:grid-cols-2">
      <SelectField label="Месец" ... />
      <SelectField label="Година" ... />
    </div>
  </div>
</div>
```

- [ ] **Step 2: Replace the entire inner content of the FormSection**

Replace everything inside `<FormSection title="Цена И Производство">` with:

```tsx
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
```

- [ ] **Step 3: Visually verify**

Reload `http://localhost:3000/new-listing` (or wherever the form lives). Confirm the price section shows one flat row of 6 fields with the checkbox below — no sub-boxes.

- [ ] **Step 4: Commit**

```bash
git add components/NewListingForm.tsx
git commit -m "feat: flatten price/production row in new listing form"
```

---

### Task 3: Restructure extras to 4-column layout

**Files:**
- Modify: `components/NewListingForm.tsx`

- [ ] **Step 1: Locate the extras section (around line 1382)**

Find:
```tsx
<FormSection title="Екстри">
  <div className="grid gap-4 xl:grid-cols-5 md:grid-cols-2">
    {EXTRA_SECTIONS.map((section) => (
      <ExtrasColumn
        key={section.category}
        category={section.category}
        items={section.items}
        selected={form.extras[section.category] ?? []}
        onToggle={(label) => toggleExtra(section.category, label)}
      />
    ))}
  </div>
</FormSection>
```

- [ ] **Step 2: Replace the extras grid with the 4-column layout**

The 7 sections map to columns as follows:
- Col 1 (wide): Безопасност (index 0)
- Col 2 (wide): Комфорт (index 1)
- Col 3 (narrow): Други (index 2) stacked over Екстериор (index 3)
- Col 4 (narrow): Защита (index 4) + Интериор (index 5) + Специализирани (index 6)

Replace the `<FormSection title="Екстри">` content with:

```tsx
<FormSection title="Екстри">
  <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.6fr_0.6fr] md:grid-cols-2">
    {/* Col 1 — Безопасност */}
    <ExtrasColumn
      category={EXTRA_SECTIONS[0].category}
      items={EXTRA_SECTIONS[0].items}
      selected={form.extras[EXTRA_SECTIONS[0].category] ?? []}
      onToggle={(label) => toggleExtra(EXTRA_SECTIONS[0].category, label)}
    />
    {/* Col 2 — Комфорт */}
    <ExtrasColumn
      category={EXTRA_SECTIONS[1].category}
      items={EXTRA_SECTIONS[1].items}
      selected={form.extras[EXTRA_SECTIONS[1].category] ?? []}
      onToggle={(label) => toggleExtra(EXTRA_SECTIONS[1].category, label)}
    />
    {/* Col 3 — Други stacked over Екстериор */}
    <div className="flex flex-col gap-4">
      <ExtrasColumn
        category={EXTRA_SECTIONS[2].category}
        items={EXTRA_SECTIONS[2].items}
        selected={form.extras[EXTRA_SECTIONS[2].category] ?? []}
        onToggle={(label) => toggleExtra(EXTRA_SECTIONS[2].category, label)}
      />
      <ExtrasColumn
        category={EXTRA_SECTIONS[3].category}
        items={EXTRA_SECTIONS[3].items}
        selected={form.extras[EXTRA_SECTIONS[3].category] ?? []}
        onToggle={(label) => toggleExtra(EXTRA_SECTIONS[3].category, label)}
      />
    </div>
    {/* Col 4 — Защита + Интериор + Специализирани */}
    <div className="flex flex-col gap-4">
      <ExtrasColumn
        category={EXTRA_SECTIONS[4].category}
        items={EXTRA_SECTIONS[4].items}
        selected={form.extras[EXTRA_SECTIONS[4].category] ?? []}
        onToggle={(label) => toggleExtra(EXTRA_SECTIONS[4].category, label)}
      />
      <ExtrasColumn
        category={EXTRA_SECTIONS[5].category}
        items={EXTRA_SECTIONS[5].items}
        selected={form.extras[EXTRA_SECTIONS[5].category] ?? []}
        onToggle={(label) => toggleExtra(EXTRA_SECTIONS[5].category, label)}
      />
      <ExtrasColumn
        category={EXTRA_SECTIONS[6].category}
        items={EXTRA_SECTIONS[6].items}
        selected={form.extras[EXTRA_SECTIONS[6].category] ?? []}
        onToggle={(label) => toggleExtra(EXTRA_SECTIONS[6].category, label)}
      />
    </div>
  </div>
</FormSection>
```

- [ ] **Step 3: Verify EXTRA_SECTIONS order matches assumption**

Confirm in the file that `EXTRA_SECTIONS` is defined in this exact order (it is):
```
[0] Безопасност  [1] Комфорт  [2] Други  [3] Екстериор
[4] Защита  [5] Интериор  [6] Специализирани
```

- [ ] **Step 4: Visually verify**

Reload the new listing page. Confirm extras shows 4 columns at xl width: Безопасност and Комфорт are wide; the third column has Други above Екстериор; the fourth column has Защита, Интериор, Специализирани stacked.

- [ ] **Step 5: Commit**

```bash
git add components/NewListingForm.tsx
git commit -m "feat: restructure extras to 4-column layout matching mobile.bg"
```
