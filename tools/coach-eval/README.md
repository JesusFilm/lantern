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

## Run

Live runs read credentials from ~/.config/lantern/coach-eval.env (override with
COACH_EVAL_ENV): OPENROUTER_API_KEY, QWEN_TOKEN_FILE and AI_GATEWAY_CHAT_BASE_URL.
Keep that file private and outside Git; results never include credentials.

    npm run coach:eval -- budget
    npm run coach:eval -- transcripts --run NAME --targets qwen,gemini-flash --repeats 3
    npm run coach:eval -- judge --run NAME
    npm run coach:eval -- report --run NAME
    npm run coach:eval -- review --run NAME --count 20

Results go to ~/.local/state/lantern-coach-eval/NAME (override with COACH_EVAL_RUNS).
Commands skip finished transcripts and judgments, so rerunning resumes an interrupted
run. Targets are listed in targets.ts. A paid run stops starting new work once its
--max-cost (default $5) is reached; set a spending limit on the OpenRouter key too.
Keep Qwen concurrency low because the gateway is shared.

To evaluate a change, run the same scenarios and repeats on the base and changed
revisions with the same judge, then compare the reports. Add a scenario for each new
coaching problem before fixing it.
