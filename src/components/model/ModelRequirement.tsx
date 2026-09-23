import type { EngineRuntime } from "../../engine";

/** Ordered smallest to largest. A card asking for the smaller model is satisfied
 *  by the larger one, so comparison is by position, not equality. */
const ORDER = ["kev-0.6b", "kev-4b"] as const;

export type ModelAlias = (typeof ORDER)[number];

/** `runtime.model` is a full repo id like "onnx-community/kev-4b-ONNX"; the
 *  requirement is an alias. Match on the alias appearing in the id. */
export function meetsRequirement(loadedModel: string, required: string): boolean {
  const loadedIndex = ORDER.findIndex((alias) => loadedModel.includes(alias));
  const requiredIndex = ORDER.indexOf(required as ModelAlias);
  if (loadedIndex === -1 || requiredIndex === -1) return true; // unknown model: do not nag
  return loadedIndex >= requiredIndex;
}

export default function ModelRequirement({
  requires,
  runtime,
  onUpgrade,
}: {
  requires: { model: ModelAlias; why: string };
  runtime: EngineRuntime;
  onUpgrade: () => void;
}) {
  if (meetsRequirement(runtime.model, requires.model)) return null;

  const name = requires.model === "kev-4b" ? "Kev 4B" : "Kev 0.6B";
  return (
    <div className="rounded-2xl bg-amber-50 p-4 text-sm">
      <p>
        <span className="font-semibold">This cookbook requires {name}. </span>
        {requires.why}
      </p>
      <p className="mt-2 text-stone">
        You can run it on the model you have and see the result for yourself — on a
        page about confidence, a flat answer is worth seeing.
      </p>
      <button
        type="button"
        onClick={onUpgrade}
        className="mt-3 rounded-xl bg-ink px-3 py-2 font-semibold text-white"
      >
        Load {name}
      </button>
    </div>
  );
}
