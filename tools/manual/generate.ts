import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, type Browser } from "@playwright/test";
import { build } from "vite";
import { capture, CaptureError, contextOptions, launchOptions, watchPage, type CaptureFrame } from "./capture.js";
import { chapters, supplied } from "./content.js";
import { currentManifest, manualDirectory, outdatedSupplied, pdfName, productSources, readManifest, recordManifest } from "./freshness.js";
import { allShots, isSupplied, type Shot } from "./manual.js";
import { deckHtml, printPdf, type Assets } from "./render.js";
import { manualNow, startWorld, type ManualWorld } from "./world.js";
import sharp from "sharp";

/**
 * npm run manual [-- --only=shot-id,…] [-- --confirm=supplied-id,…]
 * Photographs every scene, writes changed screenshots, renders a new edition
 * when the deck changed, and records the manifest that npm run manual:check verifies.
 */
const root = process.cwd();
const args = new Map(process.argv.slice(2).map((arg) => { const [k, v = ""] = arg.replace(/^--/, "").split("="); return [k!, v]; }));
const only = args.get("only")?.split(",").filter(Boolean);
const confirm = args.get("confirm")?.split(",").filter(Boolean) ?? [];
const output = join(root, manualDirectory);
const screenshots = only ? join(root, "output", "manual-preview") : join(output, "screenshots");
const layout = { root, supplied };
const log = (message: string) => process.stdout.write(message + "\n");

const frameName = (shot: Shot, index: number, total: number) => (total > 1 ? `${shot.id}-${index + 1}.png` : `${shot.id}.png`);

async function photograph(browser: Browser, world: ManualWorld, shot: Shot): Promise<CaptureFrame[]> {
  const context = await browser.newContext(contextOptions(shot.device ?? "desktop"));
  try {
    await context.clock.setFixedTime(new Date(manualNow));
    const session = world.session(shot.persona);
    if (session) await context.addCookies([{ name: "lantern-session", value: session, url: world.origin }]);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const watcher = watchPage(page);
    const path = typeof shot.path === "function" ? shot.path(world.ids) : (shot.path ?? "/");
    await page.goto(world.origin + path);
    await shot.act?.(page, world.ids);
    await expect(shot.ready(page)).toBeVisible();
    return await capture(page, shot.mode ?? { kind: "viewport" }, { watcher, highlight: shot.highlight });
  } finally {
    await context.close();
  }
}

async function writeIfChanged(path: string, data: Buffer) {
  const existing = await readFile(path).catch(() => undefined);
  if (existing?.equals(data)) return false;
  await writeFile(path, data);
  return true;
}

const ids = allShots(chapters).map((shot) => shot.id);
const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
if (duplicate) throw new Error(`Two shots share the id ${duplicate}.`);
for (const id of confirm) if (!supplied.some((s) => s.id === id)) throw new Error(`No supplied capture is called ${id}.`);

const client = await mkdtemp(join(tmpdir(), "lantern-manual-client-"));
const browser = await chromium.launch(launchOptions);
let world: ManualWorld | undefined;
try {
  log("Building the client…");
  await build({ root, logLevel: "warn", build: { outDir: client, emptyOutDir: true } });
  const shots = allShots(chapters).filter((s): s is Shot => !isSupplied(s)).filter((s) => !only || only.includes(s.id));
  if (only && shots.length !== only.length) throw new Error(`Unknown shot in --only: ${only.filter((id) => !shots.some((s) => s.id === id)).join(", ")}`);
  const captured = new Map<string, CaptureFrame[]>();
  const failures: string[] = [];
  world = await startWorld(client);
  for (const shot of shots) {
    const started = Date.now();
    try {
      captured.set(shot.id, await photograph(browser, world, shot));
      log(`  ✓ ${shot.id} (${captured.get(shot.id)!.length} frame${captured.get(shot.id)!.length > 1 ? "s" : ""}, ${Date.now() - started} ms)`);
    } catch (error) {
      failures.push(`${shot.id}: ${error instanceof CaptureError ? "" : "(scene) "}${(error as Error).message.split("\n").slice(0, 6).join("\n    ")}`);
      log(`  ✗ ${shot.id}`);
    }
    if (shot.mutates) {
      await world.close();
      world = await startWorld(client);
    }
  }
  if (failures.length) throw new Error(`${failures.length} scene(s) failed; nothing was written:\n  ${failures.join("\n  ")}`);

  await mkdir(screenshots, { recursive: true });
  const written = new Set<string>();
  let changed = 0;
  for (const shot of shots) {
    const frames = captured.get(shot.id)!;
    for (const [index, frame] of frames.entries()) {
      const name = frameName(shot, index, frames.length);
      written.add(name);
      if (await writeIfChanged(join(screenshots, name), frame.image)) changed++;
    }
  }
  log(`${changed} screenshot(s) changed of ${written.size}.`);
  if (only) {
    log(`Preview written to ${screenshots}; the manual itself was not updated.`);
  } else {
    let removed = 0;
    for (const name of await readdir(screenshots))
      if (name.endsWith(".png") && !written.has(name)) { await rm(join(screenshots, name)); removed++; }
    if (removed) log(`${removed} obsolete screenshot(s) removed.`);

    const assets: Assets = { shots: {}, supplied: {} };
    for (const shot of shots) {
      const frames = captured.get(shot.id)!;
      assets.shots[shot.id] = frames.map((frame, index) => ({ file: join(screenshots, frameName(shot, index, frames.length)), width: frame.viewport.width, height: frame.viewport.height }));
    }
    const previous = await readManifest(root);
    const outdated = await outdatedSupplied(layout, await currentManifest(layout, { edition: 0, editionDate: "", deck: "", confirm }));
    for (const item of supplied) {
      const file = join(output, "supplied", item.file);
      const image = await readFile(file).catch(() => undefined);
      if (!image) continue;
      const meta = await sharp(image).metadata();
      const scale = (meta.density ?? 72) >= 144 ? 2 : 1;
      assets.supplied[item.id] = { file, width: meta.width! / scale, height: meta.height! / scale, outdated: outdated[item.id] ?? [] };
    }
    const fingerprint = (await productSources(root)).fingerprint;
    const draft = await deckHtml(chapters, assets, { edition: 0, date: "", fingerprint });
    const deck = createHash("sha256").update(draft).digest("hex");
    const pdfPath = join(output, pdfName);
    const pdfMatches = previous?.pdf && createHash("sha256").update(await readFile(pdfPath).catch(() => Buffer.alloc(0))).digest("hex") === previous.pdf;
    let edition = previous?.edition ?? 0, editionDate = previous?.editionDate ?? "";
    if (deck !== previous?.deck || !pdfMatches) {
      edition++;
      editionDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(new Date());
      const pdf = await printPdf(browser, await deckHtml(chapters, assets, { edition, date: editionDate, fingerprint }));
      await writeFile(pdfPath, pdf);
      log(`Rendered edition ${edition} (${(pdf.length / 1048576).toFixed(1)} MB): ${resolve(pdfPath)}`);
    } else log(`The deck is unchanged; edition ${edition} remains current.`);
    await recordManifest(layout, { edition, editionDate, deck, confirm });
    for (const item of supplied) if (!assets.supplied[item.id]) log(`Pending supplied capture: ${item.id} → docs/manual/supplied/${item.file}`);
    for (const [id, paths] of Object.entries(outdated)) log(`Supplied capture ${id} may be outdated (${paths.join(", ")}).`);
  }
} finally {
  await world?.close();
  await browser.close();
  await rm(client, { recursive: true, force: true });
}

