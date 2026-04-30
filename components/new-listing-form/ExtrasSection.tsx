import { ExtrasColumn, FormSection } from "@/components/new-listing-form/ui";
import { EXTRA_SECTIONS, type FormState } from "@/components/new-listing-form/constants";

export function ExtrasSection({
  extras,
  onToggle,
}: {
  extras: FormState["extras"];
  onToggle: (category: string, label: string) => void;
}) {
  return (
    <FormSection title="Екстри">
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.6fr_0.6fr] md:grid-cols-2">
        <ExtrasColumn
          category={EXTRA_SECTIONS[0].category}
          items={EXTRA_SECTIONS[0].items}
          selected={extras[EXTRA_SECTIONS[0].category] ?? []}
          onToggle={(label) => onToggle(EXTRA_SECTIONS[0].category, label)}
        />
        <ExtrasColumn
          category={EXTRA_SECTIONS[1].category}
          items={EXTRA_SECTIONS[1].items}
          selected={extras[EXTRA_SECTIONS[1].category] ?? []}
          onToggle={(label) => onToggle(EXTRA_SECTIONS[1].category, label)}
        />
        <div className="flex flex-col gap-4">
          <ExtrasColumn
            category={EXTRA_SECTIONS[2].category}
            items={EXTRA_SECTIONS[2].items}
            selected={extras[EXTRA_SECTIONS[2].category] ?? []}
            onToggle={(label) => onToggle(EXTRA_SECTIONS[2].category, label)}
          />
          <ExtrasColumn
            category={EXTRA_SECTIONS[3].category}
            items={EXTRA_SECTIONS[3].items}
            selected={extras[EXTRA_SECTIONS[3].category] ?? []}
            onToggle={(label) => onToggle(EXTRA_SECTIONS[3].category, label)}
          />
        </div>
        <div className="flex flex-col gap-4">
          <ExtrasColumn
            category={EXTRA_SECTIONS[4].category}
            items={EXTRA_SECTIONS[4].items}
            selected={extras[EXTRA_SECTIONS[4].category] ?? []}
            onToggle={(label) => onToggle(EXTRA_SECTIONS[4].category, label)}
          />
          <ExtrasColumn
            category={EXTRA_SECTIONS[5].category}
            items={EXTRA_SECTIONS[5].items}
            selected={extras[EXTRA_SECTIONS[5].category] ?? []}
            onToggle={(label) => onToggle(EXTRA_SECTIONS[5].category, label)}
          />
          <ExtrasColumn
            category={EXTRA_SECTIONS[6].category}
            items={EXTRA_SECTIONS[6].items}
            selected={extras[EXTRA_SECTIONS[6].category] ?? []}
            onToggle={(label) => onToggle(EXTRA_SECTIONS[6].category, label)}
          />
        </div>
      </div>
    </FormSection>
  );
}
