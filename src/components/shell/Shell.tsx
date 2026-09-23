import { useState } from "react";
import type { Engine } from "../../engine";
import ConsistencyNoulCard from "../cards/ConsistencyNoulCard";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function Shell({ engine }: { engine: Engine }) {
  const [selected, setSelected] = useState("consistency-noul");
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar runtime={engine.runtime} />
      <div className="flex flex-1">
        <Sidebar selected={selected} onSelect={setSelected} />
        <main className="flex-1 p-6">
          {/* One card in Phase 1; the switch grows as cards land. */}
          <ConsistencyNoulCard engine={engine} />
        </main>
      </div>
    </div>
  );
}
