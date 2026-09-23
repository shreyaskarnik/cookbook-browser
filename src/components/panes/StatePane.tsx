export default function StatePane({
  value,
  onChange,
  tokens,
  exact,
  disabled,
}: {
  value: string;
  onChange: (text: string) => void;
  tokens: number;
  /** Whether `tokens` came from the real tokenizer. An unprimed estimate
   *  undercounts by roughly 1.8x to 2.2x, so it is marked rather than shown
   *  as though it were the true figure. */
  exact: boolean;
  disabled: boolean;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor="state" className="font-semibold">
          State
        </label>
        <span className="text-sm text-stone">
          {exact ? "" : "≈"}
          {tokens} tokens
        </span>
      </div>
      <textarea
        id="state"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        rows={14}
        className="w-full resize-y rounded-xl border border-line p-3 font-mono text-sm"
      />
    </section>
  );
}
