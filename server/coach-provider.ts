/** Provider credentials never cross the HTTP application boundary. */
export interface CoachProviderConfig {
  primary: { url: string; key: string; model: string };
  fallback: { url: string; key: string; model: string };
  timeoutMs: number;
  cooldownMs: number;
}
export function resolveCoachConfig(
  env: NodeJS.ProcessEnv = process.env,
): CoachProviderConfig | undefined {
  if (env.COACH_ENABLED && !["0", "1"].includes(env.COACH_ENABLED))
    throw new Error("Invalid COACH_ENABLED.");
  if (env.COACH_ENABLED !== "1") return;
  const key = (name: string) => {
    const value = env[name]?.trim();
    if (!value || /[\r\n]/.test(value))
      throw new Error(`${name} is required when coaching is enabled.`);
    return value;
  };
  const url = (name: string, fallback: string) => {
    const value = env[name] || fallback;
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`Invalid ${name}.`);
    }
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    )
      throw new Error(`Invalid ${name}: HTTPS is required.`);
    return value.replace(/\/$/, "");
  };
  return {
    primary: {
      key: key("AI_GATEWAY_CHAT_API_KEY"),
      url: url("AI_GATEWAY_CHAT_BASE_URL", "https://ai-gateway.jesusfilm.org"),
      model: env.AI_GATEWAY_CHAT_MODEL || "coding",
    },
    fallback: {
      key: key("OPENROUTER_API_KEY"),
      url: "https://openrouter.ai/api/v1",
      model: env.COACH_FALLBACK_MODEL || "google/gemini-3.8-flash",
    },
    timeoutMs: 25000,
    cooldownMs: 60000,
  };
}
export class CoachUnavailable extends Error {
  constructor() {
    super(
      "The coach could not reply. Your writing is still here. Try again or continue manually.",
    );
  }
}
export type CoachProvider = ReturnType<typeof createCoachProvider>;
export function createCoachProvider(
  config: CoachProviderConfig,
  report: (event: {
    event: "coach-provider";
    provider: "primary" | "fallback";
    outcome: "ok" | "failed";
    elapsedMs: number;
  }) => void = (event) => console.info(JSON.stringify(event)),
) {
  let retryPrimaryAt = 0,
    probing = false;
  async function attempt<T>(
    provider: "primary" | "fallback",
    system: string,
    context: string,
    validate: (value: unknown) => T,
    signal?: AbortSignal,
  ): Promise<T> {
    const start = Date.now(),
      settings = config[provider];
    const abort = AbortSignal.any([
      AbortSignal.timeout(config.timeoutMs),
      ...(signal ? [signal] : []),
    ]);
    try {
      const response = await fetch(
        settings.url +
          (provider === "primary" ? "/v1/messages" : "/chat/completions"),
        {
          method: "POST",
          redirect: "error",
          signal: abort,
          headers: {
            Authorization: `Bearer ${settings.key}`,
            "Content-Type": "application/json",
            ...(provider === "primary"
              ? { "anthropic-version": "2023-06-01" }
              : {}),
          },
          body: JSON.stringify(
            provider === "primary"
              ? {
                  model: settings.model,
                  max_tokens: 2200,
                  system,
                  messages: [{ role: "user", content: context }],
                }
              : {
                  model: settings.model,
                  max_tokens: 2200,
                  messages: [
                    { role: "system", content: system },
                    { role: "user", content: context },
                  ],
                  response_format: { type: "json_object" },
                },
          ),
        },
      );
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new Error("Provider rejected request");
      }
      const reader = response.body.getReader();
      let bytes = 0,
        raw = "";
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 128000) throw new Error("Provider response too large");
          raw += decoder.decode(value, { stream: true });
        }
        raw += decoder.decode();
      } finally {
        await reader.cancel();
      }
      const envelope = JSON.parse(raw);
      if (
        envelope.stop_reason === "max_tokens" ||
        envelope.choices?.[0]?.finish_reason === "length"
      )
        throw new Error("Truncated response");
      const content =
        provider === "primary"
          ? envelope.content
              ?.filter((b: { type: string }) => b.type === "text")
              .map((b: { text: string }) => b.text)
              .join("")
          : envelope.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("Missing response");
      const parsed = JSON.parse(
        content
          .replace(/<think>[\s\S]*?<\/think>/g, "")
          .trim()
          .replace(/^```(?:json)?\s*/, "")
          .replace(/\s*```$/, ""),
      );
      const result = validate(parsed);
      signal?.throwIfAborted();
      report({
        event: "coach-provider",
        provider,
        outcome: "ok",
        elapsedMs: Date.now() - start,
      });
      return result;
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      report({
        event: "coach-provider",
        provider,
        outcome: "failed",
        elapsedMs: Date.now() - start,
      });
      throw error;
    }
  }
  return {
    async suggest<T>(
      system: string,
      context: string,
      validate: (value: unknown) => T,
      signal?: AbortSignal,
    ): Promise<T> {
      signal?.throwIfAborted();
      if (Date.now() >= retryPrimaryAt && !probing) {
        const probe = retryPrimaryAt !== 0;
        if (probe) probing = true;
        try {
          const result = await attempt(
            "primary",
            system,
            context,
            validate,
            signal,
          );
          retryPrimaryAt = 0;
          return result;
        } catch {
          signal?.throwIfAborted();
          retryPrimaryAt = Date.now() + config.cooldownMs;
        } finally {
          if (probe) probing = false;
        }
      }
      try {
        return await attempt("fallback", system, context, validate, signal);
      } catch {
        signal?.throwIfAborted();
        throw new CoachUnavailable();
      }
    },
  };
}
