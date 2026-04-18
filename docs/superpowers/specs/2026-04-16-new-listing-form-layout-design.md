# NewListingForm Layout — Match Mobile.bg

**Date:** 2026-04-16  
**File:** `components/NewListingForm.tsx`

## Goal

Restructure `NewListingForm.tsx` so the field layout matches the mobile.bg create-listing form exactly.

## Reference

Mobile.bg create listing URL: `https://www.mobile.bg/pcgi/mobile.cgi?pubtype=1&act=6&subact=4&actions=1`  
Field order confirmed from captured `mobilebg_edit_form_snapshots.fields_json`.

---

## Changes Required

### 1. Add Fuel field (Двигател) — Row 1

`fuel` exists in `FormState` and is passed via the `fuels` prop but is never rendered.

- Add a `SelectField` for fuel between **Заглавие** and **Състояние** in the first grid row.
- Options: `["", ...fuels.filter(Boolean)]`
- Row 1 grid becomes 6 columns: Основна категория | Марка | Модел | Заглавие | **Двигател** | Состояние

### 2. Flatten the price section

Currently: three nested sub-boxes (`[Цена+ДДС+Валута box]` | `Пробег` | `[Месец+Година box]`).

Target: one flat grid row with all six fields:  
`Цена | ДДС | Валута | Пробег [км] | Месец | Година`  
followed by the `☐ Цена само при запитване` checkbox below.

Remove the `<div className="min-w-0 rounded-xl ...">` wrappers. Use a single `grid` with proportional columns (e.g. `xl:grid-cols-[80px_1.8fr_90px_90px_130px_100px]`).

### 3. Restructure extras — 4 columns, first two wider

Current: `xl:grid-cols-5` (all 7 sections in one flat grid).

Target: 4-column grid, `grid-template-columns: 1fr 1fr 0.6fr 0.6fr`, with stacking in the narrow columns:

| Col 1 (1fr) | Col 2 (1fr) | Col 3 (0.6fr) | Col 4 (0.6fr) |
|---|---|---|---|
| Безопасност | Комфорт | Други | Защита |
| | | Екстериор | Интериор |
| | | | Специализирани |

Implementation: wrap EXTRA_SECTIONS into two groups rendered as sub-columns inside the outer grid.

---

## Fields unchanged

- Row 2: Мощност | Евростандарт | Скоростна кутия | Категория ✓
- Row 3: Кубатура | Пробег с зареждане | Капацитет батерия ✓
- Color & Location: Цвят | Находится в | Град | VIN ✓
- Description & Contact ✓
