import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import pg from "pg";
// Shared target validation is maintained as a JavaScript module.
// @ts-expect-error The release module has no TypeScript declaration.
import { validateHostedMigrationTarget } from "../release/settings.mjs";
import { resetQaDepartment } from "./qa-fixture.js";

const env = process.env;
try {
  assert.equal(env.GITHUB_REPOSITORY, "JesusFilm/lantern");
  assert.equal(env.GITHUB_REF, "refs/heads/main");
  assert.equal(env.GITHUB_EVENT_NAME, "workflow_dispatch");
  assert.equal(env.RELEASE_TARGET, "stage");
  assert.equal(env.RAILWAY_PROJECT, "9a445065-bde0-4184-bdb8-4161b033cc8f");
  assert.equal(env.RAILWAY_ENVIRONMENT, "8e19675b-08a2-4bfb-9762-fd6d8561fcfd");
  assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), env.GITHUB_SHA);
  const emails = [env.QA_SHARON, env.QA_SUSHMA, env.QA_ESTHER];
  assert.ok(emails.every((v) => typeof v === "string" && /^[^\s@]+@[^\s@]+$/.test(v)));
  const choices = { SharonQA: env.QA_SHARON, SushmaQA: env.QA_SUSHMA, EstherQA: env.QA_ESTHER };
  assert.ok(env.QA_LEAD === "keep" || Object.hasOwn(choices, env.QA_LEAD ?? ""));
  const { url } = validateHostedMigrationTarget(env, "stage", env.MIGRATION_DATABASE_CA);
  // Match the release tooling's pinned Railway CA and verify-ca semantics.
  const db = new pg.Pool({ connectionString: url.href, ssl: { ca: env.MIGRATION_DATABASE_CA, rejectUnauthorized: true, checkServerIdentity: () => undefined }, options: "-c search_path=lantern" });
  try {
    const result = await resetQaDepartment(db, { participants: emails as string[], lead: env.QA_LEAD === "keep" ? undefined : choices[env.QA_LEAD as keyof typeof choices] });
    console.log(`QA fixture restored. Registered: ${result.registered}; awaiting first sign-in: ${result.missing}.`);
  } finally { await db.end(); }
} catch {
  console.error("QA provisioning failed safely. Check staging target, private participant configuration, registration and fixture ownership.");
  process.exitCode = 1;
}
