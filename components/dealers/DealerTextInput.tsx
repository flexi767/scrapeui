import type { InputHTMLAttributes } from "react";

const DEFAULT_CLASS_NAME =
  "rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none min-w-0";

export function DealerTextInput({
  className = DEFAULT_CLASS_NAME,
  onValueChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  onValueChange: (value: string) => void;
}) {
  return (
    <input
      {...props}
      className={className}
      onChange={(event) => onValueChange(event.target.value)}
    />
  );
}
