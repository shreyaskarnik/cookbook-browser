import type { EngineRuntime } from "../../engine";

export default function TopBar({ runtime }: { runtime: EngineRuntime }) {
  return (
    <header className="flex items-center justify-between border-b border-line px-6 py-3">
      <span className="font-semibold">Cookbook in the browser</span>
      <span className="flex items-center gap-3 text-sm text-stone">
        <span className="rounded-full bg-white px-2 py-0.5">{runtime.model}</span>
        <span className="rounded-full bg-white px-2 py-0.5">{runtime.device}</span>
        <span>running on your machine</span>
      </span>
    </header>
  );
}
