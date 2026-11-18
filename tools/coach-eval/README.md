# Coach evaluation

This harness measures how useful the Guide with AI coach is, so prompt, flow and
model changes can be compared on the same synthetic scenarios. Lantern's ordinary
tests prove the coaching workflow and contracts with fixture providers; they do not
measure the quality of generated questions, objectives or goals.

Each run replays the guided flow from client/workspace/ObjectiveEditor.tsx through
the shipped prompt, response validation and provider code, so results describe what
members experience. Only the model route differs by target. Update flow.ts when the
guided flow changes.

## What it measures

- **Scenarios** in scenarios.ts: reproductions of the QA reports (#91, #102, #104,
  #106, #123, #124, #125, #126), the original proposal's evaluation cases, and
  non-engineering roles across all three objective types. Members answer from a
  script, or a simulated member answers from private facts so the judge can detect
  invented details.
- **Deterministic checks** in checks.ts: completion, failed turns and their cause,
  latency by step, repeated or long questions, objectives forced by the three-answer
  rule, type and initiative recommendations, goal dates, and concerns raised when an
  action deserves one.
- **A judge model** in judge.ts scores faithfulness, clarification, objective, goals,
  type, alignment and role fit, checks each scenario criterion and reports blockers:
  fabricated commitments, claimed actions or overwritten member intent. A transcript
  passes when it completes with no blocker, no unmet criterion and faithfulness of at
  least 4. Use a judge from a different model family than the candidates.

Model output varies, so run each scenario several times and compare pass rates.
Calibrate the judge against blind human scores before relying on small differences.

## Member benchmark

The benchmark is the pass/fail gate for coaching changes. benchmark.ts defines
member scenarios in four groups:

- **vague**: a rough idea, then answers that range from useful to unsure;
- **rewording**: the member knows their work but not how to phrase an objective;
- **proficient**: a well-formed objective that needs little or no help;
- **adversarial**: QA probing with off-topic answers, nonsense, an unrelated
  personal goal or instructions embedded in the work description.

Each run replays ObjectiveEditor through the shipped server coaching turn
(server/coach-turn.ts), so automatic drafting and checks match production.
Members answer from scripted replies keyed to the question asked, and answer
coach feedback when they have something relevant to add.

Every run must complete, show a draft with its three checks, ask few questions,
avoid repeated questions and invented numbers, keep goal dates in the focus
period and stay quiet once every check is met. Each scenario adds a contract
written before running: wording the visible objective must or must not contain,
expected check results, whether the draft should be ready, and recommended type
or goals. A scenario passes when most of its runs pass; the suite passes when
every scenario does.

    node --import tsx tools/coach-eval/run.ts benchmark --run NAME --repeats 3
    node --import tsx tools/coach-eval/run.ts baseline --run NAME[,NAME...]

The benchmark writes benchmark.md and benchmark.json to the run directory and
compares them with the committed baseline.json. It exits non-zero when a
scenario fails by majority or regresses from the baseline. Run it before and
after every prompt, flow or model change. Record a new baseline only when a
change is accepted, preferably from two runs of the same code combined; review
regressions before replacing one. Qwen varies between runs, so a single failing
run of a scenario is expected; a scenario that loses its majority needs a look. When members report
a new problem, add a scenario and contract first, then fix the behaviour.

## Run

Live runs read credentials from ~/.config/lantern/coach-eval.env (override with
COACH_EVAL_ENV): OPENROUTER_API_KEY, QWEN_TOKEN_FILE and AI_GATEWAY_CHAT_BASE_URL.
Keep that file private and outside Git; results never include credentials.

    node --import tsx tools/coach-eval/run.ts budget
    node --import tsx tools/coach-eval/run.ts transcripts --run NAME --targets qwen,gemini-flash --repeats 3
    node --import tsx tools/coach-eval/run.ts judge --run NAME
    node --import tsx tools/coach-eval/run.ts report --run NAME
    node --import tsx tools/coach-eval/run.ts review --run NAME --count 20

Results go to ~/.local/state/lantern-coach-eval/NAME (override with COACH_EVAL_RUNS).
Commands skip finished transcripts and judgments, so rerunning resumes an interrupted
run. Targets are listed in targets.ts. A paid run stops starting new work once its
--max-cost (default $5) is reached; set a spending limit on the OpenRouter key too.
Keep Qwen concurrency low because the gateway is shared.

To evaluate a change, run the same scenarios and repeats on the base and changed
revisions with the same judge, then compare the reports. Add a scenario for each new
coaching problem before fixing it.

CI typechecks the harness and runs its offline tests in the typecheck job. The tools
are deliberately not package scripts, so the QA manual's source fingerprint is unaffected.

The CLI now replays `coach-redesign`: type first, at most one initial follow-up before returning the member’s own wording for editing, an automatic assessment when the objective reply omits one, optional answers to objective feedback in scenarios that opt in, goal-level questions, immediate goal ideas and date validation. The final check does not call a model. The legacy replay remains available in
`runCurrentFlow` with `redesigned: false` for baseline regression tests.
Saved baseline runs remain unchanged. An intentionally uncooperative scripted
member or an out-of-period date can end incomplete with a useful warning;
report that separately from model unavailability. The original strict pass score
still counts incomplete sessions as failures. Qwen is the selected model; paid
models are needed only for judging these reruns.
