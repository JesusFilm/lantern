import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { coachPrompt } from "../../server/coach-prompt.js";
import { checkTranscript } from "./checks.js";
import { loadEvalEnvironment } from "./env.js";
import { runCurrentFlow } from "./flow.js";
import { defaultJudge, judgeTranscript, renderTranscript, rubricVersion, transcriptHash, type Judgment } from "./judge.js";
import { memberFor } from "./member.js";
import { renderReport, type Row } from "./report.js";
import { direction, scenarios as judgedScenarios, type Scenario } from "./scenarios.js";
import { benchmarkScenarios, countMissingRuns, mergeResults, renderBenchmark, summarize, type BenchmarkResult } from "./benchmark.js";

const scenarios: Scenario[] = judgedScenarios;
const allScenarios: Scenario[] = [...judgedScenarios, ...benchmarkScenarios];
import { coachCaller, installInstrumentation, needsOpenRouter, spending, targets } from "./targets.js";
import type { Transcript } from "./types.js";

const usage = `Usage: node --import tsx tools/coach-eval/run.ts <command> [options]

  budget       Show the OpenRouter key's limit and spend.
  transcripts  --run NAME --targets a,b [--repeats 3] [--concurrency 2] [--scenarios x,y] [--max-cost 5]
  judge        --run NAME [--judge MODEL] [--targets a,b] [--concurrency 4] [--max-cost 5]
  report       --run NAME [--judge MODEL]
  review       --run NAME [--count 20]   Blind transcripts for human scoring.
  benchmark    --run NAME [--target qwen] [--repeats 3] [--concurrency 2] [--scenarios x,y]
               Replays the member benchmark, compares with baseline.json and applies gate.json.
               Exits non-zero when the gate fails. See docs/development/coach-benchmark.md.
  baseline     --run NAME[,NAME...]   Records those runs' combined benchmark result as tools/coach-eval/baseline.json.

Targets: ${Object.keys(targets).join(", ")}
Results: ${runsRoot()}/NAME`;

function runsRoot() {
  return process.env.COACH_EVAL_RUNS || join(process.env.XDG_STATE_HOME || join(homedir(), ".local/state"), "lantern-coach-eval");
}

const [command, ...rest] = process.argv.slice(2);
const args = new Map<string, string>();
for (let i = 0; i < rest.length; i += 2) {
  if (!rest[i]?.startsWith("--") || rest[i + 1] === undefined) throw new Error(usage);
  args.set(rest[i]!.slice(2), rest[i + 1]!);
}
const list = (name: string) => args.get(name)?.split(",").map((s) => s.trim()).filter(Boolean);
const number = (name: string, fallback: number) => {
  const value = Number(args.get(name) ?? fallback);
  if (!Number.isFinite(value) || value < 0) throw new Error(`--${name} must be a number`);
  return value;
};
const slug = (text: string) => text.replace(/[^a-z0-9.-]+/gi, "_");

function runDirectory() {
  const name = args.get("run");
  if (!name || !/^[\w.-]+$/.test(name)) throw new Error("Supply --run NAME using letters, numbers, dots or dashes.");
  return join(runsRoot(), name);
}

async function pool<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
      while (next < items.length) await work(items[next++]!);
    }),
  );
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function loadTranscripts(dir: string, only?: string[]): Transcript[] {
  const root = join(dir, "transcripts");
  const flow: Transcript["flow"] = existsSync(join(dir, "run.json")) && readJson<{ flow?: string }>(join(dir, "run.json")).flow?.startsWith("coach-redesign") ? "redesigned" : "legacy";
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((target) => !only || only.includes(target))
    .flatMap((target) => readdirSync(join(root, target)).map((file) => ({ ...readJson<Transcript>(join(root, target, file)), flow })))
    .sort((a, b) => a.target.localeCompare(b.target) || a.scenario.localeCompare(b.scenario) || a.repeat - b.repeat);
}

const judgmentFile = (dir: string, judge: string, t: Transcript) =>
  join(dir, "judgments", slug(judge), t.target, `${t.scenario}.${t.repeat}.json`);

async function budget() {
  const env = loadEvalEnvironment();
  if (!env.openRouterKey) return console.log("OPENROUTER_API_KEY is not set in " + env.file);
  const response = await fetch("https://openrouter.ai/api/v1/key", {
    headers: { Authorization: `Bearer ${env.openRouterKey}` },
  });
  const data = ((await response.json().catch(() => ({}))) as { data?: Record<string, unknown> }).data ?? {};
  console.log(JSON.stringify({ status: response.status, limit: data.limit, usage: data.usage, remaining: data.limit_remaining }));
}

async function transcripts(suite: Scenario[] = scenarios) {
  const dir = runDirectory();
  const env = loadEvalEnvironment();
  const chosen = list("targets") ?? [];
  if (!chosen.length) throw new Error(usage);
  for (const id of chosen) {
    const target = targets[id];
    if (!target) throw new Error(`Unknown target ${id}. ${usage}`);
    if (needsOpenRouter(target) && !env.openRouterKey) throw new Error(`${id} needs OPENROUTER_API_KEY in ${env.file}`);
  }
  const picked = list("scenarios");
  const selected = picked ? suite.filter((s) => picked.includes(s.id)) : suite;
  if (picked && selected.length !== picked.length) throw new Error("Unknown scenario in --scenarios.");
  const repeats = number("repeats", 3), maxCost = number("max-cost", 5), concurrency = number("concurrency", 2);
  installInstrumentation();
  mkdirSync(dir, { recursive: true });
  const metaFile = join(dir, "run.json");
  const meta = existsSync(metaFile) ? readJson<Record<string, unknown>>(metaFile) : {};
  const git = (...a: string[]) => execFileSync("git", a, { encoding: "utf8" }).trim();
  writeFileSync(
    metaFile,
    JSON.stringify(
      {
        ...meta,
        created: meta.created ?? new Date().toISOString(),
        commit: git("rev-parse", "--short", "HEAD") + (git("status", "--porcelain") ? "+dirty" : ""),
        promptHash: createHash("sha256").update(coachPrompt(direction, true).replace(/Current date: \S+/, "")).digest("hex").slice(0, 12),
        flow: "coach-redesign ObjectiveEditor",
        targets: { ...(meta.targets as object), ...Object.fromEntries(chosen.map((id) => [id, targets[id]])) },
      },
      null,
      2,
    ),
  );
  const tasks = chosen.flatMap((target) =>
    selected.flatMap((scenario) => Array.from({ length: repeats }, (_, i) => ({ target, scenario, repeat: i + 1 }))),
  );
  let done = 0, skipped = 0;
  const startedAll = Date.now();
  await pool(tasks, concurrency, async ({ target, scenario, repeat }) => {
    const file = join(dir, "transcripts", target, `${scenario.id}.${repeat}.json`);
    if (existsSync(file)) return void done++;
    if (spending() >= maxCost) return void skipped++;
    const started = Date.now();
    try {
      const today = scenario.focus.start;
      const result = await runCurrentFlow(scenario, coachCaller(targets[target]!, env, true, direction, today), memberFor(scenario, env), { redesigned: true, today });
      const transcript: Transcript = {
        flow: "redesigned",
        scenario: scenario.id,
        target,
        repeat,
        today,
        startedAt: new Date(started).toISOString(),
        durationMs: Date.now() - started,
        ...result,
      };
      mkdirSync(join(dir, "transcripts", target), { recursive: true });
      writeFileSync(file, JSON.stringify(transcript, null, 2));
      done++;
      console.log(`[${done}/${tasks.length}] ${target} ${scenario.id}#${repeat} ${result.outcome.completed ? "completed" : result.outcome.failure} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
    } catch (error) {
      // Simulated-member or harness failures leave no transcript; rerunning fills the gap.
      console.log(`[skip] ${target} ${scenario.id}#${repeat}: ${(error as Error).message}`);
    }
  });
  console.log(`Wrote ${done} transcripts in ${((Date.now() - startedAll) / 60000).toFixed(1)} min; OpenRouter spend this command $${spending().toFixed(3)}${skipped ? ", " + skipped + " skipped at the cost cap" : ""}.`);
}

async function judge() {
  const dir = runDirectory();
  const env = loadEvalEnvironment();
  const model = args.get("judge") ?? defaultJudge;
  const maxCost = number("max-cost", 5), concurrency = number("concurrency", 4);
  const pending = loadTranscripts(dir, list("targets")).filter((t) => {
    const file = judgmentFile(dir, model, t);
    if (!existsSync(file)) return true;
    const existing = readJson<Judgment>(file);
    return existing.transcriptHash !== transcriptHash(t) || existing.rubricVersion !== rubricVersion;
  });
  let done = 0, failed = 0;
  await pool(pending, concurrency, async (t) => {
    if (spending() >= maxCost) return;
    const scenario = allScenarios.find((s) => s.id === t.scenario);
    if (!scenario) return;
    try {
      const judgment = await judgeTranscript(env, model, t, scenario);
      const file = judgmentFile(dir, model, t);
      mkdirSync(join(file, ".."), { recursive: true });
      writeFileSync(file, JSON.stringify(judgment, null, 2));
      done++;
    } catch (error) {
      failed++;
      console.log(`[judge failed] ${t.target} ${t.scenario}#${t.repeat}: ${(error as Error).message}`);
    }
  });
  console.log(`Judged ${done} of ${pending.length} pending transcripts with ${model}${failed ? " (" + failed + " failed)" : ""}; spend $${spending().toFixed(3)}.`);
}

function report() {
  const dir = runDirectory();
  const model = args.get("judge") ?? defaultJudge;
  const redesigned = existsSync(join(dir, "run.json")) && readJson<{ flow?: string }>(join(dir, "run.json")).flow?.startsWith("coach-redesign") === true;
  const rows: Row[] = loadTranscripts(dir).flatMap((transcript) => {
    const scenario = allScenarios.find((s) => s.id === transcript.scenario);
    if (!scenario) return [];
    const file = judgmentFile(dir, model, transcript);
    const judgment = existsSync(file) ? readJson<Judgment>(file) : undefined;
    return [{
      transcript,
      scenario,
      checks: checkTranscript(transcript, scenario, redesigned),
      ...(judgment && judgment.transcriptHash === transcriptHash(transcript) ? { judgment } : {}),
    }];
  });
  const meta = existsSync(join(dir, "run.json")) ? readJson<{ commit?: string; promptHash?: string }>(join(dir, "run.json")) : {};
  const labels = Object.fromEntries(Object.values(targets).map((t) => [t.id, t.label]));
  const { markdown, summaries } = renderReport(rows, {
    title: `Coach evaluation: ${args.get("run")}`,
    labels,
    ...(rows.some((r) => r.judgment) ? { judge: model } : {}),
    notes: [`Commit ${meta.commit ?? "unknown"}, prompt ${meta.promptHash ?? "unknown"}, ${new Set(rows.map(r => r.transcript.scenario)).size} scenarios, rubric ${rubricVersion}.`],
  });
  writeFileSync(join(dir, "report.md"), markdown);
  writeFileSync(join(dir, "report.json"), JSON.stringify(summaries, null, 2));
  console.log(markdown);
}

function review() {
  const dir = runDirectory();
  const count = number("count", 20);
  const all = loadTranscripts(dir);
  // Deterministic shuffle so the same run always yields the same review set.
  const keyed = all
    .map((t) => ({ t, k: createHash("sha256").update(`${t.target}/${t.scenario}/${t.repeat}`).digest("hex") }))
    .sort((a, b) => a.k.localeCompare(b.k))
    .slice(0, count);
  const key: Record<string, { target: string; scenario: string; repeat: number }> = {};
  const sections = keyed.map(({ t }, i) => {
    const id = "R" + String(i + 1).padStart(2, "0");
    key[id] = { target: t.target, scenario: t.scenario, repeat: t.repeat };
    const scenario = allScenarios.find((s) => s.id === t.scenario)!;
    return [
      `## ${id}`,
      "",
      "```text",
      renderTranscript(t, scenario),
      "```",
      "",
      "Scores (1–5 or n/a): faithfulness _ · clarification _ · objective _ · goals _ · type _ · alignment _ · role _",
      "Criteria met (c1, c2…): _ · Blocker? _ · Notes: _",
      "",
    ].join("\n");
  });
  writeFileSync(join(dir, "review.md"), `# Blind coach review\n\nScore each transcript without knowing which model produced it.\n\n${sections.join("\n")}`);
  writeFileSync(join(dir, "review-key.json"), JSON.stringify(key, null, 2));
  console.log(`Wrote ${keyed.length} blind transcripts to ${join(dir, "review.md")}`);
}

const baselineFile = fileURLToPath(new URL("./baseline.json", import.meta.url));

async function benchmark() {
  const dir = runDirectory();
  const target = args.get("target") ?? "qwen";
  args.set("targets", target);
  await transcripts(benchmarkScenarios);
  const runs = loadTranscripts(dir, [target]).filter((t) => benchmarkScenarios.some((s) => s.id === t.scenario));
  const meta = readJson<{ commit?: string }>(join(dir, "run.json"));
  const picked = list("scenarios");
  const expected = picked ?? benchmarkScenarios.map((s) => s.id);
  const result = countMissingRuns(
    summarize(runs, { commit: meta.commit ?? "unknown", target, createdAt: new Date().toISOString() }),
    expected,
    number("repeats", 3),
  );
  const baseline = existsSync(baselineFile) ? readJson<BenchmarkResult>(baselineFile) : undefined;
  const { markdown, passed } = renderBenchmark(result, baseline, { expected });
  writeFileSync(join(dir, "benchmark.json"), JSON.stringify(result, null, 2));
  writeFileSync(join(dir, "benchmark.md"), markdown);
  console.log(markdown);
  if (!passed) process.exitCode = 1;
}

function baseline() {
  const names = list("run") ?? [];
  if (!names.length || names.some((name) => !/^[\w.-]+$/.test(name))) throw new Error("Supply --run NAME[,NAME...].");
  const results = names.map((name) => {
    const file = join(runsRoot(), name, "benchmark.json");
    if (!existsSync(file)) throw new Error(`Run the benchmark for ${name} first.`);
    return readJson<BenchmarkResult>(file);
  });
  const merged = mergeResults(results);
  writeFileSync(baselineFile, JSON.stringify(merged, null, 2) + "\n");
  console.log(renderBenchmark(merged).markdown);
  console.log(`Recorded ${names.join(", ")} as ${baselineFile}.`);
}

const commands: Record<string, () => unknown> = { budget, transcripts: () => transcripts(), judge, report, review, benchmark, baseline };
const selectedCommand = command ? commands[command] : undefined;
if (!selectedCommand) {
  console.log(usage);
  process.exitCode = 1;
} else await selectedCommand();
