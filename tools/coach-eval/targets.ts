import { AsyncLocalStorage } from "node:async_hooks";
import { coachPrompt } from "../../server/coach-prompt.js";
import { validateSuggestion } from "../../server/coach-contract.js";
import {
  CoachUnavailable,
  createCoachProvider,
  type CoachProviderConfig,
} from "../../server/coach-provider.js";
import type { EvalEnvironment } from "./env.js";
import { direction } from "./scenarios.js";
import type { Attempt, AttemptOutcome, CoachCall } from "./types.js";

/**
 * A coach configuration under test. Requests go through the shipped provider:
 * "primary" is the Qwen gateway protocol, "fallback" the OpenRouter protocol,
 * and "app" both, exactly as members experience them.
 */
export interface Target {
  id: string;
  label: string;
  route: "primary" | "fallback" | "app";
  model: string;
  /** Experimental request fields merged into the provider's JSON body. */
  overrides?: Record<string, unknown>;
}

export const targets: Record<string, Target> = Object.fromEntries(
  (
    [
      { id: "qwen", label: "Qwen 3.8 27B, JFP gateway (shipped primary)", route: "primary", model: "coding" },
      {
        id: "qwen-tuned",
        label: "Qwen 3.8 27B, model-card sampling",
        route: "primary",
        model: "coding",
        overrides: { temperature: 0.7, top_p: 0.8, top_k: 20, presence_penalty: 1.5 },
      },
      { id: "gemini-flash", label: "Gemini 3.8 Flash, OpenRouter (shipped fallback)", route: "fallback", model: "google/gemini-3.8-flash" },
      { id: "qwen-hosted", label: "Qwen 3.8 27B, OpenRouter", route: "fallback", model: "qwen/qwen3.8-27b" },
      { id: "claude-haiku", label: "Claude Haiku 5.5, OpenRouter", route: "fallback", model: "anthropic/claude-haiku-5.5" },
      { id: "claude-sonnet", label: "Claude Sonnet 5.5, OpenRouter", route: "fallback", model: "anthropic/claude-sonnet-5.5" },
      { id: "gpt-terra", label: "GPT-6.1 Terra, OpenRouter", route: "fallback", model: "openai/gpt-6.1-terra" },
      { id: "app", label: "Shipped Qwen then Gemini fallback", route: "app", model: "coding" },
    ] satisfies Target[]
  ).map((target) => [target.id, target]),
);

const unavailable = "https://unavailable.coach-eval.invalid";
const openRouter = "https://openrouter.ai/api/v1";

interface Scope {
  attempts: Attempt[];
  target: Target;
  models: { primary: string; fallback: string };
}
const scope = new AsyncLocalStorage<Scope>();
let spentUsd = 0;
export const spending = () => spentUsd;

/** Records each provider request made inside a coach turn; values never include credentials. */
export function installInstrumentation() {
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init) => {
    const current = scope.getStore();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!current) return realFetch(input, init);
    if (url.startsWith(unavailable)) throw new TypeError("Provider disabled for this target");
    const route: Attempt["route"] = url.endsWith("/v1/messages") ? "primary" : "fallback";
    let body = init?.body;
    if (typeof body === "string") {
      const parsed = JSON.parse(body);
      if (current.target.overrides && current.target.route !== "app")
        Object.assign(parsed, current.target.overrides);
      if (url.startsWith(openRouter)) parsed.usage = { include: true };
      body = JSON.stringify(parsed);
    }
    const attempt: Attempt = {
      route,
      model: current.models[route],
      outcome: "network",
      elapsedMs: 0,
    };
    current.attempts.push(attempt);
    const started = performance.now();
    try {
      const response = await realFetch(input, { ...init, body });
      const raw = await response.text();
      attempt.elapsedMs = Math.round(performance.now() - started);
      attempt.status = response.status;
      attempt.outcome = response.ok ? "unparseable" : (`http-${response.status}` as AttemptOutcome);
      try {
        const envelope = JSON.parse(raw);
        const usage = envelope.usage ?? {};
        attempt.inputTokens = usage.input_tokens ?? usage.prompt_tokens;
        attempt.outputTokens = usage.output_tokens ?? usage.completion_tokens;
        if (typeof usage.cost === "number") {
          attempt.costUsd = usage.cost;
          spentUsd += usage.cost;
        }
        attempt.stopReason = envelope.stop_reason ?? envelope.choices?.[0]?.finish_reason;
        const content =
          route === "primary"
            ? envelope.content?.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("")
            : envelope.choices?.[0]?.message?.content;
        if (typeof content === "string") attempt.content = content.slice(0, 8000);
        if (attempt.stopReason === "max_tokens" || attempt.stopReason === "length") attempt.outcome = "truncated";
      } catch {
        // An unreadable envelope stays "unparseable" or the HTTP status.
      }
      return new Response(raw, { status: response.status, statusText: response.statusText });
    } catch (error) {
      attempt.elapsedMs = Math.round(performance.now() - started);
      const name = (error as Error).name;
      attempt.outcome = name === "TimeoutError" || name === "AbortError" ? "timeout" : "network";
      throw error;
    }
  };
}

function providerConfig(target: Target, env: EvalEnvironment): CoachProviderConfig {
  const qwen = () => {
    if (!env.qwenKey) throw new Error("QWEN_TOKEN_FILE is not configured.");
    return { url: env.gatewayUrl, key: env.qwenKey, model: target.model };
  };
  const router = (model: string) => {
    if (!env.openRouterKey) throw new Error("OPENROUTER_API_KEY is not configured.");
    return { url: openRouter, key: env.openRouterKey, model };
  };
  const off = { url: unavailable, key: "unused", model: "unused" };
  const shipped = { timeoutMs: 25000, cooldownMs: 60000 };
  if (target.route === "primary") return { primary: qwen(), fallback: off, ...shipped };
  if (target.route === "fallback") return { primary: off, fallback: router(target.model), ...shipped };
  return { primary: qwen(), fallback: router("google/gemini-3.8-flash"), ...shipped };
}

export function needsOpenRouter(target: Target) {
  return target.route !== "primary";
}

/** Calls the shipped prompt, provider and response contract for one coach turn. */
export function coachCaller(target: Target, env: EvalEnvironment): CoachCall {
  const config = providerConfig(target, env);
  const ids = direction.initiatives.filter((i) => !i.archived).map((i) => i.id);
  return async (stage, context) => {
    // A fresh provider per turn keeps one target's outage from cooling down the next turn.
    const provider = createCoachProvider(config, () => {});
    const attempts: Attempt[] = [];
    const models = { primary: config.primary.model, fallback: config.fallback.model };
    const started = performance.now();
    const validate = (value: unknown) => {
      const attempt = attempts.at(-1);
      try {
        const result = validateSuggestion(stage, value, ids);
        if (attempt) attempt.outcome = "ok";
        return result;
      } catch (error) {
        if (attempt) attempt.outcome = "schema";
        throw error;
      }
    };
    try {
      const suggestion = await scope.run({ attempts, target, models }, () =>
        provider.suggest(coachPrompt(direction), JSON.stringify({ stage, context }), validate),
      );
      return { ok: true, suggestion, elapsedMs: Math.round(performance.now() - started), attempts };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof CoachUnavailable ? "unavailable" : (error as Error).message,
        elapsedMs: Math.round(performance.now() - started),
        attempts,
      };
    }
  };
}

/** A plain-text completion used for the simulated member and the judge. */
export async function complete(
  env: EvalEnvironment,
  via: "qwen" | { openRouterModel: string },
  system: string,
  user: string,
  options: { temperature?: number; maxTokens?: number; json?: boolean } = {},
): Promise<string> {
  const signal = AbortSignal.timeout(120000);
  if (via === "qwen") {
    if (!env.qwenKey) throw new Error("QWEN_TOKEN_FILE is not configured.");
    const response = await fetch(env.gatewayUrl + "/v1/messages", {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${env.qwenKey}`, "Content-Type": "application/json", "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "coding",
        max_tokens: options.maxTokens ?? 400,
        temperature: options.temperature ?? 0.2,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!response.ok) throw new Error(`Qwen request failed with ${response.status}`);
    const envelope: any = await response.json();
    return envelope.content?.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("") ?? "";
  }
  if (!env.openRouterKey) throw new Error("OPENROUTER_API_KEY is not configured.");
  const response = await fetch(openRouter + "/chat/completions", {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${env.openRouterKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: via.openRouterModel,
      max_tokens: options.maxTokens ?? 2000,
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(options.json ? { response_format: { type: "json_object" }, provider: { require_parameters: true } } : {}),
      usage: { include: true },
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter request failed with ${response.status}`);
  const envelope: any = await response.json();
  if (typeof envelope.usage?.cost === "number") spentUsd += envelope.usage.cost;
  if (envelope.choices?.[0]?.finish_reason === "length") throw new Error("Truncated completion");
  return envelope.choices?.[0]?.message?.content ?? "";
}
