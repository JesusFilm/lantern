import assert from "node:assert/strict";
import { test } from "node:test";
import type { CoachSuggestion } from "../shared/coach.js";
import type { DepartmentDirection } from "../shared/direction.js";
import { coachTurn } from "./coach-turn.js";
import { checkpoint } from "./coach-test-support.js";

const direction: DepartmentDirection = { mission: "Help everyone encounter Jesus.", initiatives: [], version: 1 };

/** A fake coach whose replies take the given number of simulated milliseconds. */
function slowCoach(replies: CoachSuggestion[], tookMs: number) {
  let clock = 0, calls = 0;
  return {
    calls: () => calls,
    now: () => clock,
    ask: async () => { calls++; clock += tookMs; return replies.shift() ?? { concern: "Still unclear." }; },
  };
}

test("empty goal ideas are retried only when the first reply left time for another call", async () => {
  const context = { ...checkpoint, entry: "goal" as const, action: "", goal: "" };
  const fast = slowCoach([{ concern: "Who reviews the plan?" }, { actions: ["Review three failure reports"] }], 2000);
  const quick = await coachTurn({ ask: fast.ask, direction, stage: "actions", context, enhanced: true, now: fast.now });
  assert.deepEqual([quick.actions, fast.calls()], [["Review three failure reports"], 2]);
  // A first reply that already took a provider timeout and fallback is not followed by another call.
  const slow = slowCoach([{ concern: "Who reviews the plan?" }, { actions: ["Review three failure reports"] }], 30000);
  const late = await coachTurn({ ask: slow.ask, direction, stage: "actions", context, enhanced: true, now: slow.now });
  assert.deepEqual([late.actions, late.concern, slow.calls()], [undefined, "Who reviews the plan?", 1]);
});
