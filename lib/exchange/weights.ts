/**
 * Weighting of the summary points (roadmap 7c): counted by the code from the source ids, never by the model.
 * Only ids that really answered this question count, each at most once.
 */

export type Weight = { count: number; answered: number; percent: number };

export function weightOf(sourceIds: string[], answerIds: string[]): Weight {
  const answered = new Set(answerIds);
  const count = new Set(sourceIds.filter((id) => answered.has(id))).size;
  return { count, answered: answered.size, percent: answered.size > 0 ? Math.round((count / answered.size) * 100) : 0 };
}

/** "5 von 8 Antworten · 63 %", German number format. */
export function weightLabel(w: Weight): string {
  const of = `${w.count} von ${w.answered} ${w.answered === 1 ? "Antwort" : "Antworten"}`;
  return `${of} · ${w.percent.toLocaleString("de-DE")} %`;
}

/** "6 von 8 Gefragten haben geantwortet". */
export function participationLabel(answered: number, asked: number): string {
  if (asked <= 0) return answered === 1 ? "1 Antwort" : `${answered} Antworten`;
  return `${answered} von ${asked} ${asked === 1 ? "Gefragten hat" : "Gefragten haben"} geantwortet`;
}
