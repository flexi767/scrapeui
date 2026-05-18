import type { PlatformAccountFields, PlatformCredentialSection } from '@/lib/dealers/platformCredentials';
import { DealerTextInput } from './DealerTextInput';

interface DealerPlatformFieldsProps<TForm extends PlatformAccountFields> {
  className?: string;
  form: TForm;
  showCredentials: boolean;
  showUrl?: boolean;
  section: PlatformCredentialSection;
  onChange: (updater: (current: TForm) => TForm) => void;
}

export function DealerPlatformFields<TForm extends PlatformAccountFields>({
  className,
  form,
  showCredentials,
  showUrl = true,
  section,
  onChange,
}: DealerPlatformFieldsProps<TForm>) {
  const fields = section.fields.filter((field) => showUrl || field.type !== 'url');
  const visibleFields = showCredentials ? fields : fields.filter((field) => field.type === 'url');

  return (
    <>
      {visibleFields.map((field) => (
        <DealerTextInput
          key={field.key}
          value={form[field.key]}
          onValueChange={(value) =>
            onChange((current) => ({ ...current, [field.key]: value }))
          }
          placeholder={field.placeholder ?? field.label}
          className={className}
          type={field.type}
        />
      ))}
    </>
  );
}
