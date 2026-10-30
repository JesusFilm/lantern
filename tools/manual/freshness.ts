import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";

/** Where the generated manual lives, relative to the repository root. */
export const manualDirectory = "docs/manual";
export const pdfName = "lantern-manual.pdf";
export const regenerate = "Run `npm run manual` and commit docs/manual.";

/** A screenshot a person must take, such as Google's own sign-in screens. */
export interface SuppliedCapture {
  id: string;
  /** File name inside docs/manual/supplied. */
  file: string;
  /** Repository paths whose changes may make the capture inaccurate. */
  sources: string[];
}
export interface ManualLayout {
  root: string;
  supplied: SuppliedCapture[];
}
interface SuppliedRecord {
  image: string | null;
  /** Source hashes when a person last supplied or confirmed the capture. */
  capturedFor: Record<string, string | null>;
}
export interface Manifest {
  edition: number;
  editionDate: string;
  /** Hash of the rendered deck content, used to decide whether a new edition is needed. */
  deck: string;
  sources: { fingerprint: string; files: Record<string, string> };
  screenshots: Record<string, string>;
  supplied: Record<string, SuppliedRecord>;
  pdf: string | null;
}

/**
 * Product behavior and presentation that the manual documents. Tests, operations
 * documents and the manual's own output are deliberately excluded.
 */
export function isProductSource(path: string) {
  if (/\.test\.(ts|tsx|mjs)$/.test(path) || /test-support\.ts$/.test(path)) return false;
  if (path.startsWith("tools/manual/")) return !/\/(README\.md|_[^/]*)$/.test(path);
  return (
    ["client/", "shared/", "server/", "public/"].some((prefix) => path.startsWith(prefix)) ||
    ["index.html", "vite.config.ts", "docs/PRD.md"].includes(path)
  );
}

const sha = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");
async function hashFile(path: string) {
  try {
    return sha(await readFile(path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function walk(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return [".git", "node_modules", "dist"].includes(entry.name) ? [] : walk(root, path);
      return [relative(root, path).split("\\").join("/")];
    }),
  );
  return files.flat();
}

/** Tracked and new, non-ignored files; falls back to the file system outside Git. */
async function listFiles(root: string) {
  try {
    const { stdout } = await promisify(execFile)("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root, maxBuffer: 64 << 20 });
    const listed = [...new Set(stdout.split("\0").filter(Boolean))];
    const present = await Promise.all(listed.map((path) => stat(join(root, path)).then((s) => s.isFile(), () => false)));
    return listed.filter((_, index) => present[index]);
  } catch {
    return walk(root);
  }
}

export async function productSources(root: string) {
  const files: Record<string, string> = {};
  for (const path of (await listFiles(root)).filter(isProductSource).sort()) files[path] = (await hashFile(join(root, path)))!;
  return { fingerprint: sha(JSON.stringify(files)), files };
}

async function screenshotHashes(root: string) {
  const directory = join(root, manualDirectory, "screenshots");
  const names = await readdir(directory).catch(() => [] as string[]);
  const hashes: Record<string, string> = {};
  for (const name of names.filter((n) => n.endsWith(".png")).sort()) hashes[name] = (await hashFile(join(directory, name)))!;
  return hashes;
}

const suppliedPath = (root: string, capture: SuppliedCapture) => join(root, manualDirectory, "supplied", capture.file);
async function sourceHashes(root: string, paths: string[]) {
  return Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await hashFile(join(root, path))] as const)));
}

export async function readManifest(root: string): Promise<Manifest | undefined> {
  try {
    return JSON.parse(await readFile(join(root, manualDirectory, "manifest.json"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/** Supplied captures whose sources changed after a person last supplied or confirmed them. */
export async function outdatedSupplied(layout: ManualLayout, manifest: Manifest | undefined) {
  const outdated: Record<string, string[]> = {};
  for (const capture of layout.supplied) {
    const record = manifest?.supplied[capture.id];
    if (!record?.image) continue;
    const current = await sourceHashes(layout.root, capture.sources);
    const changed = capture.sources.filter((path) => current[path] !== record.capturedFor[path]);
    if (changed.length) outdated[capture.id] = changed;
  }
  return outdated;
}

/** The manifest describing the current sources, screenshots, supplied captures and PDF. */
export async function currentManifest(
  layout: ManualLayout,
  edition: { edition: number; editionDate: string; deck: string; confirm?: string[] },
): Promise<Manifest> {
  const previous = await readManifest(layout.root);
  const supplied: Record<string, SuppliedRecord> = {};
  for (const capture of layout.supplied) {
    const image = await hashFile(suppliedPath(layout.root, capture));
    const before = previous?.supplied[capture.id];
    const accepted = !before || before.image !== image || edition.confirm?.includes(capture.id);
    supplied[capture.id] = { image, capturedFor: accepted ? await sourceHashes(layout.root, capture.sources) : before.capturedFor };
  }
  return {
    edition: edition.edition,
    editionDate: edition.editionDate,
    deck: edition.deck,
    sources: await productSources(layout.root),
    screenshots: await screenshotHashes(layout.root),
    supplied,
    pdf: await hashFile(join(layout.root, manualDirectory, pdfName)),
  };
}

/** Records the current state as the generated manual. */
export async function recordManifest(layout: ManualLayout, edition: Parameters<typeof currentManifest>[1]) {
  const manifest = await currentManifest(layout, edition);
  await mkdir(join(layout.root, manualDirectory), { recursive: true });
  await writeFile(join(layout.root, manualDirectory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

/** Fast check, without a browser or database, that the committed manual matches the source. */
export async function checkManual(layout: ManualLayout) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const manifest = await readManifest(layout.root);
  if (!manifest) return { errors: [`The manual has not been generated. ${regenerate}`], warnings };

  const current = await productSources(layout.root);
  if (current.fingerprint !== manifest.sources.fingerprint) {
    const recorded = manifest.sources.files;
    const changes = [
      ...Object.keys(current.files).filter((p) => !(p in recorded)).map((p) => `added: ${p}`),
      ...Object.keys(recorded).filter((p) => !(p in current.files)).map((p) => `removed: ${p}`),
      ...Object.keys(current.files).filter((p) => p in recorded && recorded[p] !== current.files[p]).map((p) => `changed: ${p}`),
    ];
    errors.push(`Product source changed since the manual was generated. ${regenerate}\n  ${changes.join("\n  ")}`);
  }

  const screenshots = await screenshotHashes(layout.root);
  for (const [name, hash] of Object.entries(manifest.screenshots))
    if (screenshots[name] !== hash) errors.push(`Screenshot ${name} does not match the manifest. ${regenerate}`);
  for (const name of Object.keys(screenshots))
    if (!(name in manifest.screenshots)) errors.push(`Screenshot ${name} is not recorded in the manifest. ${regenerate}`);
  if ((await hashFile(join(layout.root, manualDirectory, pdfName))) !== manifest.pdf)
    errors.push(`${pdfName} does not match the manifest. ${regenerate}`);

  const outdated = await outdatedSupplied(layout, manifest);
  for (const capture of layout.supplied) {
    const image = await hashFile(suppliedPath(layout.root, capture));
    const record = manifest.supplied[capture.id];
    if (!image) warnings.push(`Supplied capture ${capture.id} has not been supplied yet (docs/manual/supplied/${capture.file}).`);
    else if (image !== record?.image) errors.push(`Supplied capture ${capture.file} changed since the manual was generated. ${regenerate}`);
    else if (outdated[capture.id])
      warnings.push(
        `Supplied capture ${capture.id} may need a recapture because its sources changed: ${outdated[capture.id]!.join(", ")}. ` +
          `Replace the image, or run \`npm run manual -- --confirm=${capture.id}\` if the screen is unchanged.`,
      );
  }
  return { errors, warnings };
}

