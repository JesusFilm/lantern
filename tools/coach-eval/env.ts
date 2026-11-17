import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Credentials for live evaluation runs. Values are never logged or written to results. */
export interface EvalEnvironment {
  file: string;
  gatewayUrl: string;
  qwenKey?: string;
  openRouterKey?: string;
}

export const defaultEnvironmentFile = join(
  homedir(),
  ".config/lantern/coach-eval.env",
);

export function loadEvalEnvironment(
  file = process.env.COACH_EVAL_ENV || defaultEnvironmentFile,
): EvalEnvironment {
  const values = new Map<string, string>();
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values.set(match[1]!, match[2]!);
  }
  const tokenFile = values.get("QWEN_TOKEN_FILE");
  let qwenKey: string | undefined;
  if (tokenFile) {
    try {
      qwenKey = readFileSync(tokenFile, "utf8").trim() || undefined;
    } catch {
      throw new Error(`Cannot read QWEN_TOKEN_FILE named in ${file}.`);
    }
  }
  const gatewayUrl = (
    values.get("AI_GATEWAY_CHAT_BASE_URL") || "https://ai-gateway.jesusfilm.org"
  ).replace(/\/$/, "");
  const openRouterKey = values.get("OPENROUTER_API_KEY") || undefined;
  for (const key of [qwenKey, openRouterKey])
    if (key && /[\s"']/.test(key))
      throw new Error(`A key in ${file} contains spaces or quotes; paste the bare key.`);
  return { file, gatewayUrl, qwenKey, openRouterKey };
}
