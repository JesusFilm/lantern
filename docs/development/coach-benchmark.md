# Coach benchmark

The coach benchmark is the required check for any change to what the AI coach
says or how guided authoring proceeds. It replays realistic members through the
shipped coaching turn on Qwen, judges each run against rules written before
running, and applies a committed gate. Use it to say whether a change improved,
kept or reduced coaching quality, instead of retesting by hand.

## When to run it

Run the benchmark before and after changing any of these:

- prompts, Guide principles or rules in `server/coach-guidance.ts` and
  `server/coach-prompt.ts`;
- the response contract or turn logic in `server/coach-contract.ts` and
  `server/coach-turn.ts`;
- provider, model or sampling settings in `server/coach-provider.ts` or the
  hosted coach configuration;
- the guided flow in `client/workspace/ObjectiveEditor.tsx`. The benchmark replays
  that flow from `tools/coach-eval/flow.ts`, so update `flow.ts` in the same change;
- the Guide content, synthetic mission or initiatives the coach reads.

Ordinary tests still prove the coaching workflow, persistence and access rules
with fixture providers. They cannot show whether generated wording is useful;
the benchmark does that.

## Procedure

1. When a member or QA reports a coaching problem, add a scenario to
   `tools/coach-eval/benchmark.ts` first. Give it a category and a contract that
   describes the behavior you want, then confirm it fails on the current code.
2. Make the change. Keep `flow.ts` in step with `ObjectiveEditor.tsx`.
3. Run the benchmark on the changed code:

       node --import tsx tools/coach-eval/run.ts benchmark --run NAME --repeats 3

   It takes about five minutes and makes about 180 Qwen requests. Qwen requests
   cost nothing; the benchmark makes no OpenRouter calls. Keep `--concurrency` at
   2 or less because the Qwen key is shared.
4. Read `benchmark.md` in the run directory. It shows the gate result, each
   category, each scenario's runs against the baseline and the most common failed
   assertions. Open the transcripts for any scenario that lost its majority.
5. Put the gate table and notable changes in the PR under `## Coach benchmark`.
   A failed gate blocks the change until it is fixed or the owner accepts a gate
   or baseline change.
6. When a change is accepted and its results differ from the baseline, record a
   new baseline from two runs of the final code and commit it with the change:

       node --import tsx tools/coach-eval/run.ts baseline --run NAME-1,NAME-2

   Do not replace the baseline to hide a regression.

Local runs read credentials from `~/.config/lantern/coach-eval.env`; see the
[harness README](../../tools/coach-eval/README.md). Use `--scenarios id,id` to
iterate quickly on a few scenarios; the gate then expects only those scenarios.
Run the full set before reporting.

## Scenarios

Each scenario belongs to one kind of member. Together they cover the people the
coach must serve and the ways QA tries to break it.

| Category | Member | Scenarios |
| --- | --- | --- |
| vague | A rough idea, then answers that range from useful to unsure | gospel video app, support FAQ, goal evidence unknown, "not sure" tester |
| rewording | Knows their work but not how to phrase an objective | subtitles for East African churches, Playwright growth, mentoring new engineers |
| proficient | A well-formed objective that needs little or no help | existing captions objective, partner search, accessibility auditing growth |
| adversarial | QA probing | off-topic fitness answers, embedded instructions, gibberish, holiday Spanish |

Every run must complete and show a draft with all three checks. It must not
ask too many or repeated questions, invent numbers or put goal dates outside
the focus period, and it must stay quiet once every check is met. Each scenario's
contract adds what the visible objective must or must not contain, expected
check results, whether it should be ready, and any recommended type or goals.
A run passes when every assertion passes; a scenario passes when most of its
runs pass.

## The gate

Qwen's output varies, so the gate allows scattered failures and small trade-offs
but fails when a kind of member stops being served. The values live in
[gate.json](../../tools/coach-eval/gate.json). The command and the CI check both
read that file and print each rule with its required value.

| Rule | Value | Why |
| --- | --- | --- |
| Overall runs passing | at least 80% | The baseline passes 94% (73 of 78 runs). Single runs of the same code passed 90% and 97%; 80% leaves room for that variation and small intended trade-offs. |
| Drop from baseline | at most 10 points | Measured on the same scenarios. With the current baseline this means at least 84%. It stops quality sliding gradually as each change spends the margin. |
| Scenarios below majority | at most 2 | One or two unstable scenarios are tolerated; more indicates a behavior change. |
| Runs passing in each category | at least 60% | No kind of member, including QA probing, can be traded away for the others. |

A run the harness could not record (for example after a crash) counts as a
failed run, and a scenario with no runs counts as failing, so a partial sample
cannot pass. Change `gate.json` only in a PR that
explains why. The owner decides on loosening it; tightening it after a sustained
improvement is encouraged.

When most failures say `completed` with `unavailable`, the Qwen gateway was down
or rate limited. Rerun the benchmark rather than treating it as a quality result.

## Pull request check

The **Coach benchmark** workflow
([coach-benchmark.yml](../../.github/workflows/coach-benchmark.yml)) runs on
pull requests to main. It runs the benchmark only when the PR changes coaching
files: the coach server modules, Guide content, synthetic direction, shared coach
types, `ObjectiveEditor.tsx`, the harness or the workflow itself. Otherwise it
passes immediately with a note. The benchmark replays the guided flow from
`flow.ts`, so a change to `ObjectiveEditor.tsx` is measured only once `flow.ts`
is updated to match it. It can also be started manually from the Actions tab
with a chosen number of repeats.

The check posts `benchmark.md` as the job summary and uploads the transcripts as
an artifact for 30 days. It fails when the gate fails or the key is missing.

The check needs one-time setup by a repository administrator:

1. Obtain a dedicated JFP AI gateway key for the `coding` model, named for this
   check (for example "Lantern coach benchmark CI"), with the lowest rate limit
   that completes a run. Do not reuse another key. The check runs each pull
   request's own copy of the workflow and harness, so anyone who can push a
   branch to this repository could change that code to read the key. Keep it
   limited to this purpose so it can be revoked without affecting anything else.
2. In GitHub, Settings → Environments, create the `coach-eval` environment.
   Do not add required reviewers, or every coaching PR will wait for approval.
   Restrict deployment branches only if PR branches remain allowed.
3. Add the environment secret `COACH_EVAL_QWEN_KEY` with the gateway key. Add the
   variable `COACH_EVAL_GATEWAY_URL` only if the gateway is not
   `https://ai-gateway.jesusfilm.org`.
4. Run the workflow manually once and confirm the summary shows a gate result.
5. Optionally make **Coach benchmark** a required status check for main. The
   workflow runs on every PR and passes quickly when coaching is unchanged, so a
   required check never waits on unrelated PRs.

Pull requests from forks do not receive secrets. For them the check passes with a
warning, and a maintainer runs the benchmark locally if coaching changed.

## Limits

Members follow scripts keyed to the coach's questions, so the benchmark measures
how the coach handles known kinds of input, not every member. It replays the
guided flow outside the browser, so browser tests remain responsible for the
interface. It does not establish hosted provider connectivity or fallback; see
[coaching operations](../operations/coaching.md). The judged evaluation in the
[harness README](../../tools/coach-eval/README.md) compares models and wording
quality more broadly and uses paid models.
