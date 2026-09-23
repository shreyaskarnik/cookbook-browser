import type { ModelOption } from "./LoadGate";

export default function ModelChoice({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly ModelOption[];
  value: string;
  onChange: (alias: string) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="sr-only">Model</legend>
      {options.map((option) => (
        <label
          key={option.alias}
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
            value === option.alias ? "border-ink bg-white" : "border-line"
          }`}
        >
          <input
            type="radio"
            name="model"
            className="mt-1"
            checked={value === option.alias}
            onChange={() => onChange(option.alias)}
          />
          <span>
            <span className="block font-semibold">{option.name}</span>
            <span className="block text-sm text-stone">{option.note}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
