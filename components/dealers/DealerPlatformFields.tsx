import { DealerTextInput } from './DealerTextInput';

interface DealerPlatformFieldsProps {
  className?: string;
  password: string;
  passwordPlaceholder: string;
  showCredentials: boolean;
  showUrl?: boolean;
  url: string;
  urlPlaceholder: string;
  user: string;
  userPlaceholder: string;
  onPasswordChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onUserChange: (value: string) => void;
}

export function DealerPlatformFields({
  className,
  password,
  passwordPlaceholder,
  showCredentials,
  showUrl = true,
  url,
  urlPlaceholder,
  user,
  userPlaceholder,
  onPasswordChange,
  onUrlChange,
  onUserChange,
}: DealerPlatformFieldsProps) {
  return (
    <>
      {showUrl && (
        <DealerTextInput
          value={url}
          onValueChange={onUrlChange}
          placeholder={urlPlaceholder}
          className={className}
          type="url"
        />
      )}
      {showCredentials && (
        <>
          <DealerTextInput
            value={user}
            onValueChange={onUserChange}
            placeholder={userPlaceholder}
            className={className}
          />
          <DealerTextInput
            value={password}
            onValueChange={onPasswordChange}
            placeholder={passwordPlaceholder}
            className={className}
          />
        </>
      )}
    </>
  );
}
