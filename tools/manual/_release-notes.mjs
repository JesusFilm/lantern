import { execFileSync } from "node:child_process";
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
  for (const chapter of chapters) {
    if (!Array.isArray(chapter.slides)) throw new Error("Cannot read manual slides.");
    for (const slide of chapter.slides) {
      const { title, kind } = slide;
      const summary = slide.summary ?? slide.lead;
      if (typeof title !== "string" || typeof kind !== "string" || typeof summary !== "string") throw new Error("Cannot read manual slide text.");
      if (result.has(title)) throw new Error(`Duplicate manual slide: ${title}`);
      result.set(title, { kind, summary, roles: slide.roles ?? [], tryIt: slide.tryIt ?? [], check: slide.check ?? [], points: slide.points ?? slide.people ?? slide.items ?? [], shots: (slide.shots ?? []).map((shot) => shot.id) });
    }
  }
  return result;
}
const before = slides(previous), after = slides(current);
const previousManifest = JSON.parse(read(previous, "docs/manual/manifest.json"));
const currentManifest = JSON.parse(read(current, "docs/manual/manifest.json"));
const edition = previousManifest.edition;
const changes = [];
for (const [title, slide] of after) {
  const old = before.get(title);
  if (!old) changes.push(`- Added **${title}**: ${slide.summary}`);
  else {
    const details = [];
    if (old.summary !== slide.summary) details.push(slide.summary);
    if (JSON.stringify(old.roles) !== JSON.stringify(slide.roles)) details.push(`Roles: ${slide.roles.join(", ") || "none specified"}.`);
    for (const [key, label] of [["tryIt", "Step"], ["check", "Check"]]) {
      const added = slide[key].filter((item) => !old[key].includes(item));
      const removed = old[key].filter((item) => !slide[key].includes(item));
      for (const item of added) details.push(`${label}: ${item}`);
      if (removed.length && !added.length) details.push(`${removed.length} ${label.toLowerCase()}(s) removed.`);
    }
    if (JSON.stringify(old.points) !== JSON.stringify(slide.points)) {
      for (const item of slide.points) {
        const name = item.title ?? item.name;
        const previousItem = old.points.find((point) => (point.title ?? point.name) === name);
        if (JSON.stringify(item) !== JSON.stringify(previousItem)) details.push(`${name}: ${item.text}`);
      }
      for (const item of old.points) if (!slide.points.some((point) => (point.title ?? point.name) === (item.title ?? item.name))) details.push(`Removed: ${item.title ?? item.name}.`);
    }
    if (details.length) changes.push(`- Updated **${title}**: ${details.join(" ")}`);
  }
}
for (const title of before.keys()) if (!after.has(title)) changes.push(`- Removed **${title}** from the manual.`);
const screenshots = new Set([...Object.keys(previousManifest.screenshots ?? {}), ...Object.keys(currentManifest.screenshots ?? {})]
  .filter((name) => previousManifest.screenshots?.[name] !== currentManifest.screenshots?.[name]));
const supplied = new Set([...Object.keys(previousManifest.supplied ?? {}), ...Object.keys(currentManifest.supplied ?? {})]
  .filter((id) => previousManifest.supplied?.[id]?.image !== currentManifest.supplied?.[id]?.image));
for (const [title, slide] of after) {
  if (slide.shots.some((id) => supplied.has(id) || [...screenshots].some((name) => name === `${id}.png` || new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-[0-9]+\\.png$`).test(name)))) {
    changes.push(`- Updated screenshots for **${title}**.`);
  }
}
if (!changes.length) changes.push("- The manual was regenerated; no changes to slide text or screenshots were detected.");
process.stdout.write(`## What changed since edition ${edition}\n\n${changes.join("\n")}\n`);
