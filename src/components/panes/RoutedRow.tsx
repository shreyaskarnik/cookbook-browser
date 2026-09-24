import type { RoutedItem } from "../../cookbooks/routing";

const DISPOSITION_STYLE: Record<RoutedItem["disposition"], string> = {
  auto: "bg-auto",
  review: "bg-review",
};

/** The column widths `AnswersPane` has always used: a short question label, the
 *  bar, and a number beside it. A per-item list needs different ones — its
 *  label is a whole claim and its detail can be a sentence — so the widths are
 *  a parameter while everything else about the row stays shared. */
export const ANSWER_COLUMNS = "grid-cols-[11rem_1fr_5rem]";

/**
 * One routed row, wherever it is shown. Both panes speak the same `RoutedItem`
 * vocabulary, so they draw the same row rather than two visual languages for
 * the same fact: label, a bar for the quantity the rule thresholded on, and the
 * rule's own word for what happened.
 *
 * The test id and the disposition sit on the same element deliberately — a test
 * that finds a row by id reads its disposition off what it found.
 */
export default function RoutedRow({
  entry,
  band,
  columns = ANSWER_COLUMNS,
}: {
  entry: RoutedItem;
  /** Only a rule whose review region is one contiguous range of the same
   *  quantity every row is measured on has one; others pass nothing and get no
   *  overlay. */
  band?: { low: number; high: number };
  /** Tailwind grid-template-columns class for this row's three columns. */
  columns?: string;
}) {
  return (
    <div
      data-testid={`answer-${entry.key}`}
      data-disposition={entry.disposition}
      className={`grid ${columns} items-center gap-3 text-sm`}
    >
      <span className="font-medium">{entry.label}</span>
      <span className="relative h-2 rounded-full bg-line">
        {/* The band, drawn behind the bar, so a row's position relative to
            it is visible without reading the numbers. Only band-routed
            cookbooks have one. */}
        {band && (
          <span
            className="absolute inset-y-0 rounded-full bg-review/20"
            style={{
              left: `${band.low * 100}%`,
              width: `${(band.high - band.low) * 100}%`,
            }}
          />
        )}
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${DISPOSITION_STYLE[entry.disposition]}`}
          style={{ width: `${entry.value * 100}%` }}
        />
      </span>
      <span
        className={entry.disposition === "review" ? "text-review font-medium" : "text-stone"}
      >
        {/* Outcome first, then the number or option that backs it — a
            severity row has no detail, so it renders on its own. */}
        {entry.detail ? `${entry.outcome} (${entry.detail})` : entry.outcome}
      </span>
    </div>
  );
}
