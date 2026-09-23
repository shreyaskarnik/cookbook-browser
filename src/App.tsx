import { useState } from "react";
import LoadGate from "./components/load/LoadGate";
import Shell from "./components/shell/Shell";
import type { Engine } from "./engine";

export default function App() {
  // The engine lives here so it is loaded once and outlives any card.
  const [engine, setEngine] = useState<Engine | null>(null);
  return engine ? <Shell engine={engine} /> : <LoadGate onReady={setEngine} />;
}
