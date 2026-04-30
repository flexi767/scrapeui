export function FieldLabel({
  children,
  required = false,
  accent = false,
}: {
  children: React.ReactNode;
  required?: boolean;
  accent?: boolean;
}) {
  return (
    <label
      className={`text-xs font-medium ${accent ? "text-sky-300" : "text-gray-400"} uppercase tracking-wide`}
    >
      {children}
      {required ? <span className="ml-1 text-red-400">*</span> : null}
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
  accent = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | { value: string; label: string; disabled?: boolean }>;
  required?: boolean;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0 flex flex-col gap-1">
      <FieldLabel required={required} accent={accent}>
        {label}
      </FieldLabel>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-10 w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {options.map((option) => {
          if (typeof option === "string") {
            return (
              <option key={`${label}-${option || "empty"}`} value={option}>
                {option || " "}
              </option>
            );
          }
          return (
            <option
              key={`${label}-${option.value}`}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export function InputField({
  label,
  value,
  onChange,
  required = false,
  accent = false,
  type = "text",
  maxLength,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  accent?: boolean;
  type?: string;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0 flex flex-col gap-1">
      <FieldLabel required={required} accent={accent}>
        {label}
      </FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        disabled={disabled}
        className="h-10 w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-sky-500 focus:ring-0"
      />
      <span>{label}</span>
    </label>
  );
}

export function FormSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
      {title ? (
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
