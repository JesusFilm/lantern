import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadEvalEnvironment } from "./env.js";

const dir = mkdtempSync(join(tmpdir(), "coach-eval-env-"));
const missing = join(dir, "missing.env");

test("CI supplies the Qwen key through environment variables when no settings file exists", () => {
  const env = loadEvalEnvironment(missing, { COACH_EVAL_QWEN_KEY: "ci-key", COACH_EVAL_GATEWAY_URL: "https://gateway.example/" });
  assert.deepEqual([env.qwenKey, env.gatewayUrl, env.openRouterKey], ["ci-key", "https://gateway.example", undefined]);
  assert.equal(env.file, "environment variables");
});

test("a local settings file still works, and missing credentials are explained", () => {
  const token = join(dir, "qwen.token"), file = join(dir, "coach-eval.env");
  writeFileSync(token, "file-key\n");
  writeFileSync(file, `QWEN_TOKEN_FILE=${token}\nOPENROUTER_API_KEY=router\n`);
  const env = loadEvalEnvironment(file, {});
  assert.deepEqual([env.qwenKey, env.openRouterKey, env.gatewayUrl], ["file-key", "router", "https://ai-gateway.jesusfilm.org"]);
  assert.throws(() => loadEvalEnvironment(missing, {}), /COACH_EVAL_QWEN_KEY/);
});
