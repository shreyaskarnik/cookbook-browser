import type { RoutedItem } from "../../cookbooks/routing";

const DISPOSITION_STYLE: Record<RoutedItem["disposition"], string> = {
  auto: "bg-auto",
  review: "bg-review",
};

export default function AnswersPane({
  routed,
  band,
  stale,
}: {
  routed: RoutedItem[];
  /** Only band-routed cookbooks have a band to draw behind the bars. Others
   *  pass nothing and get no overlay — the bar and the disposition carry the
   *  meaning on their own. */
  band?: { low: number; high: number };
  stale: boolean;
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
            data-disposition={entry.disposition}
            className="grid grid-cols-[11rem_1fr_5rem] items-center gap-3 text-sm"
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
              className={
                entry.disposition === "review" ? "text-review font-medium" : "text-stone"
              }
            >
              {entry.detail}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
