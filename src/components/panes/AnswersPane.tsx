import type { RoutedItem } from "../../cookbooks/routing";
import RoutedRow from "./RoutedRow";

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
          <li key={entry.key}>
            <RoutedRow entry={entry} band={band} />
          </li>
        ))}
      </ul>
    </section>
  );
}
