import { CATEGORIES, entriesInCategory } from "../../cookbooks";

export default function Sidebar({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="flex w-60 shrink-0 flex-col gap-5 border-r border-line p-4">
      {CATEGORIES.map((category) => (
        <div key={category}>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone">
            {category}
          </h2>
          <ul>
            {entriesInCategory(category).map((entry) => {
              const built = entry.status === "built";
              return (
                <li key={entry.id} data-testid="cookbook-entry">
                  <button
                    type="button"
                    // Kept focusable and clickable rather than disabled, so its name
                    // is announced and the "soon" state is discoverable.
                    aria-disabled={!built}
                    aria-current={selected === entry.id ? "page" : undefined}
                    onClick={() => built && onSelect(entry.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                      selected === entry.id
                        ? "bg-white font-semibold"
                        : built
                          ? "hover:bg-white"
                          : "text-stone"
                    }`}
                  >
                    <span>{entry.title}</span>
                    {!built && (
                      <span className="rounded bg-line px-1.5 py-0.5 text-[0.65rem] uppercase">
                        soon
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
