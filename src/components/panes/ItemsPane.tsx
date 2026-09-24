import type { CookbookItem, ItemsSpec } from "../../cookbooks/items";
import type { RoutedItem, UnmeasuredItem } from "../../cookbooks/routing";
import RoutedRow from "./RoutedRow";

/** What one item has to show above its fields, once a run has produced
 *  something for it. An item whose request failed, or whose answers the rule
 *  refused, has a message instead of a row — and only that item does: the rest
 *  of the list keeps its verdicts. */
export type ItemRow =
  | { kind: "routed"; routed: RoutedItem | UnmeasuredItem }
  | { kind: "error"; message: string };

/** Wider than `AnswersPane`'s columns on both ends. The label here is a
 *  truncated claim rather than a two-word question label, and the detail is a
 *  short phrase from the cookbook's pre-check as often as it is a percentage. */
const ITEM_COLUMNS = "grid-cols-[1fr_6rem_12rem]";

/**
 * The list a per-item cookbook runs against: every item's fields editable, one
 * routed row per item once a run has produced one, and controls to add and
 * remove items. The rows are the same rows `AnswersPane` draws — see
 * `RoutedRow` — because a routed item means the same thing in both places.
 *
 * Each item's row appears as that item lands, so a run is visible working
 * through the list rather than arriving all at once. An item with no row yet
 * shows that it is waiting rather than showing the previous run's verdict,
 * which would be the card presenting old work as new.
 */
export default function ItemsPane({
  noun,
  fields,
  items,
  labelFor,
  rows,
  band,
  disabled,
  stale,
  running,
  onEdit,
  onAdd,
  onRemove,
}: {
  /** Plural noun for the list, from the cookbook — "Citations". */
  noun: string;
  fields: ItemsSpec["fields"];
  items: CookbookItem[];
  /** The cookbook's own label for one item, used for each remove button's
   *  accessible name so five of them are not five identical "Remove"s. */
  labelFor: (item: CookbookItem) => string;
  /** Keyed by item id. An item with no entry has nothing from a run yet. */
  rows: Record<string, ItemRow>;
  band?: { low: number; high: number };
  /** True while a run is in flight: the list cannot be edited underneath it. */
  disabled: boolean;
  /** True once the list has moved on from the one these rows describe. */
  stale: boolean;
  /** True while a run is in flight, so an item with no row yet says it is
   *  waiting rather than saying nothing. */
  running: boolean;
  onEdit: (id: string, field: string, value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">
          {noun}{" "}
          <span className="font-normal text-stone">
            — {items.length}, each routed on its own
          </span>
        </h3>
        {stale && (
          <span
            data-testid="items-stale-badge"
            className="rounded-full bg-review/10 px-2 py-0.5 text-xs font-medium text-review"
          >
            Stale — the list has changed
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const row = rows[item.id];
          return (
            <li
              key={item.id}
              data-testid={`item-${item.id}`}
              className="rounded-xl border border-line p-3"
            >
              <div
                data-stale={stale ? "true" : "false"}
                className={stale ? "opacity-50" : ""}
              >
                {row?.kind === "routed" && (
                  <RoutedRow entry={row.routed} band={band} columns={ITEM_COLUMNS} />
                )}
                {row?.kind === "error" && (
                  <p
                    data-testid={`item-error-${item.id}`}
                    className="rounded-lg bg-rose-50 p-2 text-sm"
                  >
                    <span className="font-semibold">No result for this one. </span>
                    {row.message}
                  </p>
                )}
                {!row && running && <p className="text-sm text-stone">Waiting…</p>}
              </div>

              <div className="mt-2 flex flex-col gap-2">
                {fields.map((field) => (
                  <label key={field.name} className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">{field.label}</span>
                    <textarea
                      value={item.fields[field.name] ?? ""}
                      rows={field.rows}
                      disabled={disabled}
                      onChange={(event) => onEdit(item.id, field.name, event.target.value)}
                      className="w-full resize-y rounded-lg border border-line p-2 font-mono text-xs"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemove(item.id)}
                  aria-label={`Remove ${labelFor(item) || "this one"}`}
                  className="rounded-lg border border-line px-2 py-1 text-sm text-stone hover:border-ink hover:text-ink disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className="mt-3 rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:border-ink disabled:opacity-60"
      >
        Add
      </button>
      <p className="mt-2 text-sm text-stone">
        Edit any of these, or add your own. They are read in this tab and go nowhere
        else.
      </p>
    </section>
  );
}
