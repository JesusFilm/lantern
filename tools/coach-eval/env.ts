import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Credentials for live evaluation runs. Values are never logged or written to results. */
export interface EvalEnvironment {
  /** The settings file, or "environment variables" when CI supplies the keys. */
  file: string;
  gatewayUrl: string;
  qwenKey?: string;
  openRouterKey?: string;
}

export const defaultEnvironmentFile = join(
  homedir(),
  ".config/lantern/coach-eval.env",
);

/**
 * Reads ~/.config/lantern/coach-eval.env locally. CI has no settings file and passes
 * COACH_EVAL_QWEN_KEY, COACH_EVAL_GATEWAY_URL and COACH_EVAL_OPENROUTER_KEY instead;
 * those variables also override the file's values.
 */
export function loadEvalEnvironment(
  file = process.env.COACH_EVAL_ENV || defaultEnvironmentFile,
  variables: Record<string, string | undefined> = process.env,
): EvalEnvironment {
  const values = new Map<string, string>();
  const fromFile = existsSync(file);
  if (!fromFile && !variables.COACH_EVAL_QWEN_KEY && !variables.COACH_EVAL_OPENROUTER_KEY)
    throw new Error(`No evaluation settings: create ${file} or set COACH_EVAL_QWEN_KEY (and optionally COACH_EVAL_OPENROUTER_KEY).`);
  for (const line of fromFile ? readFileSync(file, "utf8").split(/\r?\n/) : []) {
    if (line.trim().startsWith("#")) continue;
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values.set(match[1]!, match[2]!);
  }
  const tokenFile = values.get("QWEN_TOKEN_FILE");
  let qwenKey = variables.COACH_EVAL_QWEN_KEY?.trim() || undefined;
  if (!qwenKey && tokenFile) {
    try {
      qwenKey = readFileSync(tokenFile, "utf8").trim() || undefined;
    } catch {
      throw new Error(`Cannot read QWEN_TOKEN_FILE named in ${file}.`);
    }
  }
  const gatewayUrl = (
    variables.COACH_EVAL_GATEWAY_URL || values.get("AI_GATEWAY_CHAT_BASE_URL") || "https://ai-gateway.jesusfilm.org"
  ).replace(/\/$/, "");
  const openRouterKey = variables.COACH_EVAL_OPENROUTER_KEY?.trim() || values.get("OPENROUTER_API_KEY") || undefined;
  const source = fromFile ? file : "environment variables";
  for (const key of [qwenKey, openRouterKey])
    if (key && /[\s"']/.test(key))
      throw new Error(`A key in ${source} contains spaces or quotes; paste the bare key.`);
  return { file: source, gatewayUrl, qwenKey, openRouterKey };
}
