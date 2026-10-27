import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { createCoachProvider, resolveCoachConfig } from "./coach-provider.js";

test("coach uses Qwen first and falls back to OpenRouter after an outage", async () => {
  const calls: Array<{ path: string; authorization: string; body: any }> = [];
  let primaryFails = false;
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    calls.push({
      path: req.url!,
      authorization: req.headers.authorization!,
      body: JSON.parse(raw),
    });
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/qwen/v1/messages" && primaryFails) {
      res.writeHead(503).end("{}");
      return;
    }
    res.end(
      JSON.stringify(
        req.url?.startsWith("/qwen")
          ? { content: [{ type: "text", text: '{"goal":"Qwen goal"}' }] }
          : {
              choices: [
                {
                  message: { content: '{"goal":"Fallback goal"}' },
                  finish_reason: "stop",
                },
              ],
            },
      ),
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const provider = createCoachProvider({
      primary: { url: origin + "/qwen", key: "primary-only", model: "coding" },
      fallback: {
        url: origin + "/router",
        key: "fallback-only",
        model: "google/gemini-3.8-flash",
      },
      timeoutMs: 1000,
      cooldownMs: 1000,
    });
    const validate = (v: unknown) => {
      assert.ok(v && typeof v === "object" && "goal" in v);
      return v as { goal: string };
    };
    assert.equal(
      (await provider.suggest("system", "context", validate)).goal,
      "Qwen goal",
    );
    assert.equal(calls.length, 1);
    primaryFails = true;
    assert.equal(
      (await provider.suggest("system", "context", validate)).goal,
      "Fallback goal",
    );
    assert.deepEqual(
      calls.map((c) => c.path),
      ["/qwen/v1/messages", "/qwen/v1/messages", "/router/chat/completions"],
    );
    assert.equal(calls[2]!.authorization, "Bearer fallback-only");
    assert.equal(calls[2]!.body.model, "google/gemini-3.8-flash");
    await provider.suggest("system", "context", validate);
    assert.equal(calls.length, 4); // primary cooling down
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("enabling coaching requires both independent provider credentials", () => {
  assert.equal(resolveCoachConfig({}), undefined);
  assert.throws(
    () =>
      resolveCoachConfig({
        COACH_ENABLED: "1",
        AI_GATEWAY_CHAT_API_KEY: "secret",
      }),
    /OPENROUTER_API_KEY/,
  );
  const config = resolveCoachConfig({
    COACH_ENABLED: "1",
    AI_GATEWAY_CHAT_API_KEY: "primary",
    OPENROUTER_API_KEY: "fallback",
  });
  assert.equal(config?.fallback.model, "google/gemini-3.8-flash");
});

for (const failure of [
  "timeout",
  "invalid-json",
  "invalid-shape",
  "truncated",
  "429",
  "401",
  "oversized",
] as const)
  test(`fallback covers ${failure} and both-provider failure safely`, async () => {
    let fallbackFails = false,
      fallbackCalls = 0;
    const server = createServer((req, res) => {
      if (req.url === "/qwen/v1/messages") {
        if (failure === "timeout") return;
        if (failure === "429" || failure === "401") {
          res.writeHead(Number(failure)).end("secret-provider-diagnostic");
          return;
        }
        const value =
          failure === "invalid-json"
            ? "not json"
            : failure === "oversized"
              ? "x".repeat(130000)
              : "{}";
        res.end(
          JSON.stringify({
            content: [{ type: "text", text: value }],
            stop_reason: failure === "truncated" ? "max_tokens" : "end_turn",
          }),
        );
      } else {
        fallbackCalls++;
        if (fallbackFails) res.writeHead(503).end("secret-provider-diagnostic");
        else
          res.end(
            JSON.stringify({
              choices: [{ message: { content: '{"goal":"Recovered"}' } }],
            }),
          );
      }
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const a = server.address();
    assert.ok(a && typeof a !== "string");
    const url = `http://127.0.0.1:${a.port}`;
    const events: unknown[] = [];
    const provider = createCoachProvider(
      {
        primary: { url: url + "/qwen", key: "primary-secret", model: "coding" },
        fallback: {
          url: url + "/router",
          key: "fallback-secret",
          model: "gemini",
        },
        timeoutMs: 100,
        cooldownMs: 10000,
      },
      (event) => events.push(event),
    );
    const validate = (v: any) => {
      if (typeof v?.goal !== "string") throw new Error("Bad goal");
      return v as { goal: string };
    };
    try {
      assert.equal(
        (
          await provider.suggest(
            "private member work",
            "private context",
            validate,
          )
        ).goal,
        "Recovered",
      );
      assert.equal(fallbackCalls, 1);
      fallbackFails = true;
      await assert.rejects(
        provider.suggest("private member work", "private context", validate),
        /Your writing is still here/,
      );
      assert.doesNotMatch(JSON.stringify(events), /secret|private|diagnostic/);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

test("caller cancellation never triggers fallback", async () => {
  let calls = 0;
  const server = createServer(() => {
    calls++;
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const a = server.address();
  assert.ok(a && typeof a !== "string");
  const url = `http://127.0.0.1:${a.port}`;
  const provider = createCoachProvider(
    {
      primary: { url, key: "x", model: "coding" },
      fallback: { url, key: "y", model: "gemini" },
      timeoutMs: 500,
      cooldownMs: 1000,
    },
    () => {},
  );
  try {
    const abort = new AbortController();
    const promise = provider.suggest("s", "c", (x) => x, abort.signal);
    setTimeout(() => abort.abort(), 40);
    await assert.rejects(promise);
    assert.equal(calls, 1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
