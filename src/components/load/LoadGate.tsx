import { useEffect, useState } from "react";
import type { LoadProgress, OpenJevInfo } from "open-jev";
import { createLocalEngine, inspectModel, isWebGpuAvailable } from "../../engine";
import type { Engine } from "../../engine";
import { formatBytes, formatPercent } from "../../lib/format";
import ModelChoice from "./ModelChoice";

export type ModelOption = {
  alias: string;
  name: string;
  note: string;
  approximateBytes: number;
};

/** 0.6B first: it is the one that has a card running within a minute. */
export const MODEL_OPTIONS: readonly ModelOption[] = [
  {
    alias: "kev-0.6b",
    name: "Kev 0.6B",
    note: "Small and quick. The fastest way to see a card run.",
    approximateBytes: 340_000_000,
  },
  {
    alias: "kev-4b",
    name: "Kev 4B",
    note: "A larger download for a machine that can hold it.",
    approximateBytes: 2_300_000_000,
  },
  {
    alias: "open-jev",
    name: "open-jev",
    note: "An encoder with a short context. Suited to brief states.",
    approximateBytes: 350_000_000,
  },
];

export default function LoadGate({ onReady }: { onReady: (engine: Engine) => void }) {
  const [alias, setAlias] = useState(MODEL_OPTIONS[0].alias);
  const [info, setInfo] = useState<OpenJevInfo | null>(null);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const webgpu = isWebGpuAvailable();

  useEffect(() => {
    let current = true;
    setInfo(null);
    inspectModel(alias)
      .then((result) => {
        if (current) setInfo(result);
      })
      .catch(() => {
        if (current) setInfo(null); // the size line is omitted rather than wrong
      });
    return () => {
      current = false;
    };
  }, [alias]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      onReady(await createLocalEngine(alias, setProgress));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          Cookbook in the browser
        </h1>
        <p className="mt-2 text-stone">
          TypeSafe&rsquo;s cookbooks, runnable. The model downloads into this tab and
          runs on your machine: what you paste never leaves this tab, and there is no
          key and no account.
        </p>
      </header>

      <ModelChoice
        options={MODEL_OPTIONS}
        value={alias}
        onChange={setAlias}
        disabled={loading}
      />

      <p className="text-sm text-stone">
        {info
          ? info.isCached
            ? `Already downloaded — loads from this browser's cache. Runs on ${info.device}.`
            : `${formatBytes(info.downloadSize)} to download, once. Runs on ${info.device}.`
          : "Checking the download size…"}
      </p>

      {!webgpu && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm">
          This browser has no WebGPU, so the model runs on the CPU instead. It will
          work, but expect each decision to take a while.
        </p>
      )}

      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="rounded-xl bg-ink px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {loading
          ? progress
            ? `Loading ${formatPercent(progress.progress)}`
            : "Loading…"
          : "Load the model"}
      </button>

      {error && (
        <p className="rounded-xl bg-rose-50 p-3 text-sm">
          <span className="font-semibold">The model did not load. </span>
          {error}
        </p>
      )}
    </main>
  );
}
