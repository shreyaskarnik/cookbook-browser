import { formatPercent } from "../../lib/format";
import type { Band, RoutedQuestion } from "../../lib/routing";

const VERDICT_STYLE: Record<string, string> = {
  yes: "bg-auto",
  no: "bg-stone",
  uncertain: "bg-review",
};

export default function AnswersPane({
  routed,
  labels,
  band,
  stale,
}: {
  routed: RoutedQuestion[];
  labels: Record<string, string>;
  band: Band;
  /** Whether these answers describe the claim text currently in the box. When
   *  true, the rows themselves are dimmed and marked — not only a banner
   *  elsewhere on the page — so the mismatch is visible wherever someone is
   *  looking at the bars. */
  stale?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Answers</h3>
        {stale && (
          <span
            data-testid="answers-stale-badge"
            className="rounded-full bg-review/10 px-2 py-0.5 text-xs font-medium text-review"
          >
            Stale — text has changed
          </span>
        )}
      </div>
      <ul
        data-stale={stale ? "true" : "false"}
        className={`flex flex-col gap-2 ${stale ? "opacity-50" : ""}`}
      >
        {routed.map((entry) => (
          <li
            key={entry.key}
            data-testid={`answer-${entry.key}`}
            data-verdict={entry.verdict}
            className="grid grid-cols-[11rem_1fr_3rem_5rem] items-center gap-3 text-sm"
          >
            <span className="font-medium">{labels[entry.key]}</span>
            <span className="relative h-2 rounded-full bg-line">
              {/* The band, drawn behind the bar, so a row's position relative to
                  it is visible without reading the numbers. */}
              <span
                className="absolute inset-y-0 rounded-full bg-review/20"
                style={{
                  left: `${band.low * 100}%`,
                  width: `${(band.high - band.low) * 100}%`,
                }}
              />
              <span
                className={`absolute inset-y-0 left-0 rounded-full ${VERDICT_STYLE[entry.verdict]}`}
                style={{ width: `${entry.probability * 100}%` }}
              />
            </span>
            <span className="text-right tabular-nums">
              {formatPercent(entry.probability)}
            </span>
            <span
              className={
                entry.verdict === "uncertain"
                  ? "text-review font-medium"
                  : "text-stone"
              }
            >
              {entry.verdict === "uncertain" ? "review" : entry.verdict}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
