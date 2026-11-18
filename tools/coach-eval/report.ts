import type { Checks } from "./checks.js";
import { dimensions, passed, type Judgment } from "./judge.js";
import type { Scenario } from "./scenarios.js";
import type { Transcript } from "./types.js";

export interface Row {
  transcript: Transcript;
  scenario: Scenario;
  checks: Checks;
  judgment?: Judgment;
}

const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) + "%" : "–");
const mean = (values: number[]) =>
  values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : "–";
function percentile(values: number[], p: number) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]!;
}
const seconds = (ms?: number) => (ms === undefined ? "–" : (ms / 1000).toFixed(1) + "s");
const table = (header: string[], rows: string[][]) =>
  [header, header.map(() => "---"), ...rows].map((r) => "| " + r.join(" | ") + " |").join("\n");

export function targetSummary(rows: Row[]) {
  const judged = rows.filter((r) => r.judgment);
  const latency = rows.flatMap((r) => r.checks.latency.map((l) => l.ms));
  const turns = rows.reduce((n, r) => n + r.checks.coachTurns, 0);
  const failed = rows.reduce((n, r) => n + r.checks.failedTurns, 0);
  const kind = rows.filter((r) => r.checks.kindMatch !== undefined);
  const initiatives = rows.filter((r) => r.checks.initiativesOk !== undefined);
  const concern = rows.filter((r) => r.checks.concernExpected && r.transcript.outcome.plans.length);
  const quietConcern = rows.filter((r) => !r.checks.concernExpected && r.transcript.outcome.plans.length);
  const cost = rows.reduce(
    (sum, r) => sum + r.transcript.turns.reduce((s, t) => s + (t.type === "coach" ? t.attempts.reduce((c, a) => c + (a.costUsd ?? 0), 0) : 0), 0),
    0,
  );
  return {
    runs: rows.length,
    completed: rows.filter((r) => r.checks.completed).length,
    judged: judged.length,
    passed: judged.filter((r) => passed(r.transcript, r.judgment!)).length,
    scores: Object.fromEntries(
      dimensions.map((d) => [d, mean(judged.map((r) => r.judgment!.scores[d]).filter((s): s is number => s !== null))]),
    ),
    invented: judged.filter((r) => r.judgment!.invented.length > 0).length,
    blockers: judged.filter((r) => r.judgment!.blockers.length > 0).length,
    criteria: {
      met: judged.reduce((n, r) => n + r.judgment!.criteria.filter((c) => c.met === true).length, 0),
      total: judged.reduce((n, r) => n + r.judgment!.criteria.filter((c) => c.met !== null).length, 0),
    },
    kindMatch: [kind.filter((r) => r.checks.kindMatch).length, kind.length],
    initiativesOk: [initiatives.filter((r) => r.checks.initiativesOk).length, initiatives.length],
    concernWhenExpected: [concern.filter((r) => r.checks.concernRaised).length, concern.length],
    concernOtherwise: [quietConcern.filter((r) => r.checks.concernRaised).length, quietConcern.length],
    forcedObjective: rows.filter((r) => r.checks.forcedObjective).length,
    repeatedQuestion: rows.filter((r) => r.checks.repeatedQuestion).length,
    dateIssues: rows.filter((r) => r.checks.dateIssues.length).length,
    turns,
    failed,
    fallbackTurns: rows.reduce((n, r) => n + r.checks.fallbackTurns, 0),
    p50: percentile(latency, 0.5),
    p95: percentile(latency, 0.95),
    costUsd: cost,
  };
}

export function renderReport(
  rows: Row[],
  meta: { title: string; labels: Record<string, string>; judge?: string; notes?: string[] },
) {
  const targets = [...new Set(rows.map((r) => r.transcript.target))];
  const byTarget = Object.fromEntries(targets.map((t) => [t, rows.filter((r) => r.transcript.target === t)]));
  const summaries = Object.fromEntries(targets.map((t) => [t, targetSummary(byTarget[t]!)]));
  const ratio = ([n, d]: number[]) => `${n}/${d}`;
  const out: string[] = [`# ${meta.title}`, ""];
  if (meta.notes?.length) out.push(...meta.notes, "");
  out.push(
    "## Quality" + (meta.judge ? ` (judge: ${meta.judge})` : " (not judged)"),
    "",
    table(
      ["Target", "Pass", ...dimensions, "Criteria met", "Invented claims", "Blockers"],
      targets.map((t) => {
        const s = summaries[t]!;
        return [
          meta.labels[t] ?? t,
          s.judged ? `${pct(s.passed, s.judged)} (${s.passed}/${s.judged})` : "–",
          ...dimensions.map((d) => String(s.scores[d])),
          pct(s.criteria.met, s.criteria.total),
          s.judged ? pct(s.invented, s.judged) : "–",
          String(s.blockers),
        ];
      }),
    ),
    "",
    "## Behaviour and reliability",
    "",
    table(
      ["Target", "Completed", "Type match", "Initiatives ok", "Concern when expected", "Concern otherwise", "Objective forced after 3 answers", "Repeated question", "Date issues", "Failed turns", "Fallback turns", "Latency p50 / p95", "Cost"],
      targets.map((t) => {
        const s = summaries[t]!;
        return [
          meta.labels[t] ?? t,
          `${s.completed}/${s.runs}`,
          ratio(s.kindMatch),
          ratio(s.initiativesOk),
          ratio(s.concernWhenExpected),
          ratio(s.concernOtherwise),
          `${s.forcedObjective}/${s.runs}`,
          `${s.repeatedQuestion}/${s.runs}`,
          `${s.dateIssues}/${s.runs}`,
          `${s.failed}/${s.turns}`,
          String(s.fallbackTurns),
          `${seconds(s.p50)} / ${seconds(s.p95)}`,
          "$" + s.costUsd.toFixed(2),
        ];
      }),
    ),
    "",
    "## Latency by step (p50 / p95)",
    "",
    table(
      ["Target", "work", "question", "refine", "actions", "goal"],
      targets.map((t) => [
        meta.labels[t] ?? t,
        ...["work", "question", "refine", "actions", "goal"].map((step) => {
          const values = byTarget[t]!.flatMap((r) => r.checks.latency.filter((l) => l.step === step).map((l) => l.ms));
          return values.length ? `${seconds(percentile(values, 0.5))} / ${seconds(percentile(values, 0.95))}` : "–";
        }),
      ]),
    ),
    "",
    "## Provider attempts",
    "",
    table(
      ["Target", "Outcomes"],
      targets.map((t) => {
        const counts: Record<string, number> = {};
        for (const r of byTarget[t]!) for (const [k, v] of Object.entries(r.checks.attempts)) counts[k] = (counts[k] ?? 0) + v;
        return [meta.labels[t] ?? t, Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")];
      }),
    ),
    "",
    "## Rejected replies by cause",
    "",
    table(
      ["Target", "Causes"],
      targets.map((t) => {
        const counts: Record<string, number> = {};
        for (const r of byTarget[t]!) for (const [k, v] of Object.entries(r.checks.schemaCauses)) counts[k] = (counts[k] ?? 0) + v;
        return [meta.labels[t] ?? t, Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ") || "none"];
      }),
    ),
  );
  const cell = (subset: Row[]) => {
    const judged = subset.filter((r) => r.judgment);
    if (judged.length) return `${judged.filter((r) => passed(r.transcript, r.judgment!)).length}/${judged.length}`;
    return `${subset.filter((r) => r.checks.completed).length}/${subset.length} done`;
  };
  const issues = [...new Set(rows.flatMap((r) => r.scenario.issues))].sort();
  out.push(
    "",
    "## Pass rate by issue",
    "",
    table(["Issue", ...targets.map((t) => meta.labels[t] ?? t)], issues.map((issue) => [issue, ...targets.map((t) => cell(byTarget[t]!.filter((r) => r.scenario.issues.includes(issue))))])),
    "",
    "## Pass rate by scenario",
    "",
    table(
      ["Scenario", ...targets.map((t) => meta.labels[t] ?? t)],
      [...new Set(rows.map((r) => r.scenario.id))].map((id) => [id, ...targets.map((t) => cell(byTarget[t]!.filter((r) => r.scenario.id === id)))]),
    ),
  );
  return { markdown: out.join("\n") + "\n", summaries };
}
