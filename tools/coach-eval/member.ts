import type { EvalEnvironment } from "./env.js";
import type { Scenario } from "./scenarios.js";
import { complete } from "./targets.js";
import type { Member } from "./types.js";

/** Scripted answers come in order; simulated members answer from private facts only. */
export function memberFor(scenario: Scenario, env: EvalEnvironment): Member {
  if ("replies" in scenario.member) {
    const { replies, otherwise = "I'm not sure." } = scenario.member;
    const match = (text: string) => replies.find((reply) => reply.when.test(text))?.say;
    return {
      async answer(question) {
        return match(question) ?? otherwise;
      },
      async respond(feedback) {
        return match(feedback);
      },
    };
  }
  if ("answers" in scenario.member) {
    const answers = scenario.member.answers;
    let next = 0;
    return {
      async answer() {
        return answers[Math.min(next++, answers.length - 1)] ?? "I'm not sure.";
      },
    };
  }
  const facts = scenario.member.facts;
  const system = [
    `You are role-playing a ${scenario.role} at Jesus Film Project. An AI coach is helping you draft an objective for your position focus.`,
    `What you said about your work: ${scenario.work ?? scenario.existing?.objective ?? ""}`,
    "Facts you know (use only these):",
    ...facts.map((fact) => "- " + fact),
    "Answer the coach's question in one to three short sentences, in the first person and plain language.",
    "Use only the facts above. If they do not answer the question, say briefly that you are not sure.",
    "Do not invent numbers, names, dates or commitments. If an offered option matches your facts you may use it.",
    "Reply with the answer text only.",
  ].join("\n");
  return {
    async answer(question, options) {
      const text = await complete(
        env,
        "qwen",
        system,
        `Coach question: ${question}\nOffered options: ${options.length ? options.join(" | ") : "none"}`,
        { temperature: 0.2, maxTokens: 300 },
      );
      return text.trim() || "I'm not sure.";
    },
  };
}
