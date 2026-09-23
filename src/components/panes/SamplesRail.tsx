import type { Sample } from "../../cookbooks";

export default function SamplesRail({
  samples,
  onPick,
  disabled,
}: {
  samples: Sample[];
  onPick: (sample: Sample) => void;
  disabled: boolean;
}) {
  return (
    <aside className="flex flex-col gap-2">
      <h2 className="font-semibold">Try it on</h2>
      {samples.map((sample) => (
        <button
          key={sample.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(sample)}
          className="rounded-xl border border-line bg-white p-3 text-left hover:border-ink disabled:opacity-60"
        >
          <span className="block font-medium">{sample.label}</span>
          <span className="block text-sm text-stone">{sample.meta}</span>
        </button>
      ))}
      <p className="mt-2 rounded-xl bg-white p-3 text-sm text-stone">
        Or replace the state with your own. It is read in this tab and goes nowhere
        else, so a real document costs nothing to try.
      </p>
    </aside>
  );
}
