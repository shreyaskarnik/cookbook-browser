import type { Question } from "../../engine";

export default function QuestionsPane({
  questions,
  labels,
}: {
  questions: Record<string, Question>;
  labels: Record<string, string>;
}) {
  const entries = Object.entries(questions);
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <h3 className="mb-2 font-semibold">
        Questions{" "}
        <span className="font-normal text-stone">
          — {entries.length}, all in one request
        </span>
      </h3>
      <ul className="flex flex-col gap-1">
        {entries.map(([key, question]) => (
          <li
            key={key}
            data-testid="question-row"
            className="flex gap-2 text-sm text-stone"
          >
            <span className="w-44 shrink-0 font-medium text-ink">{labels[key]}</span>
            <span>{question.instructions}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
