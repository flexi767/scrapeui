import { DealerTextInput } from './DealerTextInput';
import { SOCIAL_CREDENTIAL_FIELDS, type SocialAccountFields } from '@/lib/dealers/socialCredentials';

interface DealerSocialFieldsProps<TForm extends SocialAccountFields<string>> {
  className?: string;
  form: TForm;
  onChange: (updater: (current: TForm) => TForm) => void;
}

export function DealerSocialFields<TForm extends SocialAccountFields<string>>({
  className,
  form,
  onChange,
}: DealerSocialFieldsProps<TForm>) {
  return (
    <>
      {SOCIAL_CREDENTIAL_FIELDS.map((field) => (
        <DealerTextInput
          key={field.key}
          placeholder={field.placeholder ?? field.label}
          value={form[field.key]}
          onValueChange={(value) =>
            onChange((current) => ({ ...current, [field.key]: value }))
          }
          className={className}
          type={field.type}
        />
      ))}
    </>
  );
}
