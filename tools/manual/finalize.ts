import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { manualDirectory, pdfName, readManifest, recordManifest, type ManualLayout } from "./freshness.js";

/** Persist the result of a successful full capture; unchanged decks retain their PDF. */
export async function finalizeGeneration(
  layout: ManualLayout,
  deck: string,
  render: (edition: number, date: string) => Promise<Buffer>,
  confirm: string[] = [],
) {
  const previous = await readManifest(layout.root);
  const path = join(layout.root, manualDirectory, pdfName);
  const pdfMatches = previous?.pdf && createHash("sha256").update(await readFile(path).catch(() => Buffer.alloc(0))).digest("hex") === previous.pdf;
  let edition = previous?.edition ?? 0, editionDate = previous?.editionDate ?? "";
  let rendered = false;
  if (deck !== previous?.deck || !pdfMatches) {
    edition++;
    editionDate = new Intl.DateTimeFormat("en-CA", {timeZone:"Pacific/Auckland"}).format(new Date());
    await writeFile(path, await render(edition, editionDate));
    rendered = true;
  }
  await recordManifest(layout, {edition, editionDate, deck, confirm});
  return {edition, rendered};
}
