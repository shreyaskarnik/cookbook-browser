import type { RoutedItem } from "../../cookbooks/routing";

const DISPOSITION_STYLE: Record<RoutedItem["disposition"], string> = {
  auto: "bg-auto",
  review: "bg-review",
};

/** The column widths `AnswersPane` has always used: a short question label, the
 *  bar, and the outcome beside it. A per-item list needs different ones — its
 *  label is a whole claim and its detail can be a sentence — so the widths are
 *  a parameter while everything else about the row stays shared. */
export const ANSWER_COLUMNS = "grid-cols-[11rem_1fr_7rem]";

/**
 * What a row whose disposition is "review" says, in words, about where it goes.
 *
 * Every rule already colours such a row differently, and two of the four also
 * happen to word their `outcome` as "Review" — but two do not: a confidence
 * floor's outcome is the chosen option ("Remove"), and the citation rule's is a
 * verdict ("verified"). On those, a row above the floor and the same row below
 * it read character for character the same, and the one thing the cookbook
 * exists to show is carried by colour alone.
 *
 * So the row says it, from the disposition itself, for every rule. Not by
 * checking whether `outcome` already reads "Review" — that breaks the day a rule
 * says "Escalate" — and not by asking each rule to supply the wording, which
 * would put the same judgment in four places and let a new rule forget it. The
 * cost is that "Review" and this marker appear together on two cards. That mild
 * redundancy is the price of a guarantee no rule can opt out of.
 */
const REVIEW_MARKER = "To a person";

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
      <div>
        <span
          className={entry.disposition === "review" ? "text-review font-medium" : "text-stone"}
        >
          {/* Outcome first, then the number or option that backs it — a
              severity row has no detail, so it renders on its own. Kept as its
              own element, so the marker below is a sibling rather than part of
              this string. */}
          {entry.detail ? `${entry.outcome} (${entry.detail})` : entry.outcome}
        </span>
        {entry.disposition === "review" && (
          <span className="block text-xs font-normal text-review">{REVIEW_MARKER}</span>
        )}
      </div>
    </div>
  );
}
