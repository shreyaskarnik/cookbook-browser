import { useState } from "react";
import { builtCookbooks } from "../../cookbooks";
import type { Engine } from "../../engine";
import CookbookCard from "../cards/CookbookCard";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function Shell({ engine }: { engine: Engine }) {
  const [selected, setSelected] = useState(builtCookbooks()[0].id);
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar runtime={engine.runtime} />
      <div className="flex flex-1">
        <Sidebar selected={selected} onSelect={setSelected} />
        <main className="flex-1 p-6">
          {/* Keyed by the selection so switching cookbooks starts the new card
              from its own first sample, rather than carrying the previous
              card's text, answers and control positions across. */}
          <CookbookCard key={selected} id={selected} engine={engine} />
        </main>
      </div>
    </div>
  );
}
