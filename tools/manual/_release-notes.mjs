import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { transformSync } from "esbuild";
import { runInNewContext } from "node:vm";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 << 20 });
const read = (ref, path) => git("show", `${ref}:${path}`);
let [previous, current] = process.argv.slice(2);
if (previous === "--release") {
  if (!current) throw new Error("Expected the manual release revision.");
  const edition = JSON.parse(read(current, "docs/manual/manifest.json")).edition;
  const pages = JSON.parse(execFileSync("gh", ["api", "--paginate", "--slurp", "repos/{owner}/{repo}/releases?per_page=100"], { encoding: "utf8", maxBuffer: 32 << 20 }));
  if (!Array.isArray(pages) || !pages.every(Array.isArray)) throw new Error("Cannot read published manual releases.");
  const candidates = pages.flat().filter((release) => !release.draft && !release.prerelease && /^manual-[1-9][0-9]*$/.test(release.tag_name))
    .map((release) => ({ tag: release.tag_name, edition: Number(release.tag_name.slice(7)) }))
    .filter((release) => Number.isSafeInteger(release.edition) && release.edition < edition)
    .sort((a, b) => b.edition - a.edition);
  if (!candidates.length) {
    process.stdout.write("## What changed\n\n- First published edition of the QA manual.\n");
    process.exit(0);
  }
  previous = candidates[0].tag;
  git("fetch", "--no-tags", "origin", `refs/tags/${previous}:refs/tags/${previous}`);
  git("merge-base", "--is-ancestor", previous, current);
  if (JSON.parse(read(previous, "docs/manual/manifest.json")).edition !== candidates[0].edition) throw new Error("Previous release tag does not match its manual edition.");
}
if (!previous || !current) throw new Error("Expected previous and current Git revisions.");
function slides(ref) {
  const source = transformSync(read(ref, "tools/manual/content.ts"), { loader: "ts", format: "cjs" }).code;
  const module = { exports: {} };
  const require = (name) => {
    if (name !== "./manual.js") throw new Error(`Unexpected manual dependency: ${name}`);
    return { allShots: () => [], isSupplied: () => false };
  };
  runInNewContext(source, { module, exports: module.exports, require }, { timeout: 5000 });
  const chapters = module.exports.chapters;
  if (!Array.isArray(chapters)) throw new Error("Cannot read manual chapters.");
  const result = new Map();
  const chapterText = new Map();
  for (const chapter of chapters) {
    if (!Array.isArray(chapter.slides)) throw new Error("Cannot read manual slides.");
    if (typeof chapter.title !== "string" || (chapter.summary !== undefined && typeof chapter.summary !== "string")) throw new Error("Cannot read manual chapter text.");
    if (chapterText.has(chapter.title)) throw new Error(`Duplicate manual chapter: ${chapter.title}`);
    chapterText.set(chapter.title, { summary: chapter.summary ?? "", slides: chapter.slides.map((slide) => slide.title) });
    for (const slide of chapter.slides) {
      const { title, kind } = slide;
      const summary = slide.summary ?? slide.lead;
      if (typeof title !== "string" || typeof kind !== "string" || typeof summary !== "string") throw new Error("Cannot read manual slide text.");
      if (result.has(title)) throw new Error(`Duplicate manual slide: ${title}`);
      result.set(title, { chapter: chapter.title, kind, summary, roles: slide.roles ?? [], tryIt: slide.tryIt ?? [], check: slide.check ?? [], points: slide.points ?? slide.people ?? slide.items ?? [], shots: (slide.shots ?? []).map(({id, caption, device, file, instructions, sources}) => ({id, caption, device: device ?? "desktop", file, instructions, sources: sources ?? []})) });
    }
  }
  return { slides: result, chapters: chapterText };
}
const oldManual = slides(previous), newManual = slides(current);
const before = oldManual.slides, after = newManual.slides;
const previousManifest = JSON.parse(read(previous, "docs/manual/manifest.json"));
const currentManifest = JSON.parse(read(current, "docs/manual/manifest.json"));
function outdated(ref, manifest, shot) {
  const record = manifest.supplied?.[shot.id];
  if (!record?.image) return [];
  return shot.sources.filter((path) => {
    let contents;
    try { contents = execFileSync("git", ["show", `${ref}:${path}`], { stdio: ["ignore", "pipe", "ignore"] }); }
    catch { return record.capturedFor[path] !== null; }
    return createHash("sha256").update(contents).digest("hex") !== record.capturedFor[path];
  });
}
const edition = previousManifest.edition;
const changes = [];
for (const [title, chapter] of newManual.chapters) {
  const old = oldManual.chapters.get(title);
  if (!old) changes.push(`- Added chapter **${title}**: ${chapter.summary}`);
  else {
    if (old.summary !== chapter.summary) changes.push(`- Updated chapter **${title}**: ${chapter.summary}`);
    const oldOrder = old.slides.filter((name) => chapter.slides.includes(name));
    const newOrder = chapter.slides.filter((name) => old.slides.includes(name));
    if (JSON.stringify(oldOrder) !== JSON.stringify(newOrder)) changes.push(`- Reordered topics in chapter **${title}**.`);
  }
}
for (const title of oldManual.chapters.keys()) if (!newManual.chapters.has(title)) changes.push(`- Removed chapter **${title}**.`);
const oldChapters = [...oldManual.chapters.keys()].filter((title) => newManual.chapters.has(title));
const newChapters = [...newManual.chapters.keys()].filter((title) => oldManual.chapters.has(title));
if (JSON.stringify(oldChapters) !== JSON.stringify(newChapters)) changes.push("- Reordered manual chapters.");
for (const [title, slide] of after) {
  const old = before.get(title);
  if (!old) {
    const details = [slide.summary];
    if (slide.roles.length) details.push(`Roles: ${slide.roles.join(", ")}.`);
    for (const item of slide.tryIt) details.push(`Step: ${item}`);
    for (const item of slide.check) details.push(`Check: ${item}`);
    for (const item of slide.points) details.push(`${item.title ?? item.name}${item.role ? ` (${item.role})` : ""}: ${item.text}`);
    changes.push(`- Added **${title}**: ${details.join(" ")}`);
  }
  else {
    if (old.chapter !== slide.chapter) changes.push(`- Moved **${title}** from **${old.chapter}** to **${slide.chapter}**.`);
    const details = [];
    if (old.kind !== slide.kind) details.push(`Slide type: ${slide.kind}.`);
    if (old.summary !== slide.summary) details.push(slide.summary);
    if (JSON.stringify(old.roles) !== JSON.stringify(slide.roles)) details.push(`Roles: ${slide.roles.join(", ") || "none specified"}.`);
    for (const [key, label] of [["tryIt", "Step"], ["check", "Check"]]) {
      const added = slide[key].filter((item) => !old[key].includes(item));
      const removed = old[key].filter((item) => !slide[key].includes(item));
      for (const item of added) details.push(`${label}: ${item}`);
      for (const item of removed) details.push(`Removed ${label.toLowerCase()}: ${item}`);
      const oldOrder = old[key].filter((item) => slide[key].includes(item));
      const newOrder = slide[key].filter((item) => old[key].includes(item));
      if (JSON.stringify(oldOrder) !== JSON.stringify(newOrder)) details.push(`${label}s reordered.`);
    }
    if (JSON.stringify(old.points) !== JSON.stringify(slide.points)) {
      for (const item of slide.points) {
        const name = item.title ?? item.name;
        const previousItem = old.points.find((point) => (point.title ?? point.name) === name);
        if (JSON.stringify(item) !== JSON.stringify(previousItem)) details.push(`${name}${item.role ? ` (${item.role})` : ""}: ${item.text}`);
      }
      for (const item of old.points) if (!slide.points.some((point) => (point.title ?? point.name) === (item.title ?? item.name))) details.push(`Removed: ${item.title ?? item.name}.`);
      const key = (point) => point.title ?? point.name;
      const oldOrder = old.points.map(key).filter((name) => slide.points.some((item) => key(item) === name));
      const newOrder = slide.points.map(key).filter((name) => old.points.some((item) => key(item) === name));
      if (JSON.stringify(oldOrder) !== JSON.stringify(newOrder)) details.push("Items reordered.");
    }
    for (const shot of slide.shots) {
      const prior = old.shots.find((item) => item.id === shot.id);
      if (!prior) details.push(`Screenshot added: ${shot.caption ?? shot.id}.`);
      else {
        if (prior.caption !== shot.caption) details.push(`Screenshot caption: ${shot.caption ?? shot.id}.`);
        if (prior.device !== shot.device) details.push(`Screenshot device: ${shot.device}.`);
        if (prior.file !== shot.file && shot.file) details.push(`Screenshot file: ${shot.file}.`);
        if (prior.instructions !== shot.instructions && shot.instructions) details.push(`Screenshot instructions: ${shot.instructions}`);
        if (previousManifest.supplied?.[shot.id]?.image && currentManifest.supplied?.[shot.id]?.image) {
          const wasOutdated = outdated(previous, previousManifest, prior);
          const nowOutdated = outdated(current, currentManifest, shot);
          if (nowOutdated.length && JSON.stringify(wasOutdated) !== JSON.stringify(nowOutdated)) details.push(`Screenshot ${shot.caption ?? shot.id} may be outdated (${nowOutdated.join(", ")}).`);
          else if (wasOutdated.length && !nowOutdated.length) details.push(`Screenshot ${shot.caption ?? shot.id} was confirmed or updated.`);
        }
      }
    }
    for (const shot of old.shots) if (!slide.shots.some((item) => item.id === shot.id)) details.push(`Screenshot removed: ${shot.caption ?? shot.id}.`);
    const oldShots = old.shots.map((shot) => shot.id).filter((id) => slide.shots.some((shot) => shot.id === id));
    const newShots = slide.shots.map((shot) => shot.id).filter((id) => old.shots.some((shot) => shot.id === id));
    if (JSON.stringify(oldShots) !== JSON.stringify(newShots)) details.push("Screenshots reordered.");
    if (details.length) changes.push(`- Updated **${title}**: ${details.join(" ")}`);
  }
}
for (const title of before.keys()) if (!after.has(title)) changes.push(`- Removed **${title}** from the manual.`);
const screenshots = new Set([...Object.keys(previousManifest.screenshots ?? {}), ...Object.keys(currentManifest.screenshots ?? {})]
  .filter((name) => previousManifest.screenshots?.[name] !== currentManifest.screenshots?.[name]));
const supplied = new Set([...Object.keys(previousManifest.supplied ?? {}), ...Object.keys(currentManifest.supplied ?? {})]
  .filter((id) => previousManifest.supplied?.[id]?.image !== currentManifest.supplied?.[id]?.image));
for (const [title, slide] of after) {
  if (slide.shots.some(({id}) => supplied.has(id) || [...screenshots].some((name) => name === `${id}.png` || new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-[0-9]+\\.png$`).test(name)))) {
    changes.push(`- Updated screenshots for **${title}**.`);
  }
}
if (!changes.length) changes.push("- The manual was regenerated; no changes to slide text or screenshots were detected.");
process.stdout.write(`## What changed since edition ${edition}\n\n${changes.join("\n")}\n`);
