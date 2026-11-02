import { readFile } from "node:fs/promises";
import type { Browser } from "@playwright/test";
import sharp from "sharp";
import { devices } from "./capture.js";
import { layoutMedia } from "./layout.js";
import { isSupplied, type Chapter, type Slide } from "./manual.js";

export interface FrameAsset { file: string; width: number; height: number }
export interface Assets {
  shots: Record<string, FrameAsset[]>;
  supplied: Record<string, { file: string; width: number; height: number; outdated: string[] } | undefined>;
}
export interface Edition { edition: number; date: string; fingerprint: string }

const slide = { width: 1280, height: 720, padding: 40, text: 392, gap: 24, header: 96, footer: 30 };
const media = { width: slide.width - slide.padding * 2 - slide.text - slide.gap, height: slide.height - slide.padding - slide.header - slide.footer - 20 };
const escape = (value: string) => value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** ① … ⑨ in slide text refer to the numbered callouts drawn on the screenshots. */
const rich = (value: string) => escape(value).replace(/[①-⑨]/g, (c) => `<span class="callout">${c.charCodeAt(0) - 0x245f}</span>`).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
const date = (iso: string) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" }) : "");

const imageCache = new Map<string, string>();
/** Embedded at least 1600 px wide (or the original size), so zooming into the PDF shows real detail. */
async function jpeg(file: string, cssWidth: number) {
  const key = file + "@" + cssWidth;
  if (!imageCache.has(key)) {
    const data = await sharp(await readFile(file))
      .resize({ width: Math.max(1600, Math.round(cssWidth * 2)), withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 86, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toBuffer();
    imageCache.set(key, "data:image/jpeg;base64," + data.toString("base64"));
  }
  return imageCache.get(key)!;
}

async function mediaHtml(item: Extract<Slide, { kind: "feature" }>, assets: Assets) {
  type Figure = { aspect: number; html: (w: number, h: number) => Promise<string> };
  const figures: Figure[] = [];
  for (const shot of item.shots) {
    if (isSupplied(shot)) {
      const asset = assets.supplied[shot.id];
      if (!asset) {
        figures.push({ aspect: 1.5, html: async (w, h) => `<figure style="width:${w}px"><div class="pending" style="width:${w}px;height:${h}px"><strong>Screenshot to be supplied</strong><span>${escape(shot.instructions)}</span><code>docs/manual/supplied/${escape(shot.file)}</code></div><figcaption>${escape(shot.caption)} · supplied by a person</figcaption></figure>` });
        continue;
      }
      figures.push({
        aspect: asset.width / asset.height,
        html: async (w, h) => `<figure style="width:${w}px"><img src="${await jpeg(asset.file, w)}" style="width:${w}px;height:${h}px">${asset.outdated.length ? `<div class="outdated">May be outdated: ${escape(asset.outdated.join(", "))} changed after capture</div>` : ""}<figcaption>${escape(shot.caption)} · supplied by a person</figcaption></figure>`,
      });
      continue;
    }
    const frames = assets.shots[shot.id] ?? [];
    const device = devices[shot.device ?? "desktop"].label;
    frames.forEach((frame, index) =>
      figures.push({
        aspect: frame.width / frame.height,
        html: async (w, h) => `<figure style="width:${w}px"><img class="${shot.device ?? "desktop"}" src="${await jpeg(frame.file, w)}" style="width:${w}px;height:${h}px"><figcaption>${index === 0 ? escape(shot.caption) + " · " : ""}${device}${frames.length > 1 ? ` · scroll ${index + 1} of ${frames.length}` : ""}</figcaption></figure>`,
      }),
    );
  }
  const { rows } = layoutMedia(figures.map((f) => f.aspect), media, 16, 28);
  const html = [];
  for (const row of rows) html.push(`<div class="row">${(await Promise.all(row.map((p) => figures[p.index]!.html(p.width, p.height)))).join("")}</div>`);
  return html.join("");
}

export async function deckHtml(chapters: Chapter[], assets: Assets, edition: Edition) {
  const pages: string[] = [];
  const footer = (n: number) => `<footer><span>Lantern QA manual${edition.edition ? " · Edition " + edition.edition : ""}</span><span>${n}</span></footer>`;
  const shotCount = Object.values(assets.shots).reduce((n, frames) => n + frames.length, 0);
  const features = chapters.flatMap((c) => c.slides).filter((s) => s.kind === "feature").length;
  pages.push(`<section class="slide cover"><div class="cover-main"><div class="brand">Lantern</div><h1>QA manual</h1>
    <p class="lede">What Lantern does, how to reach each screen, and what to check. Every screenshot is generated from the application source on a pinned device profile.</p></div>
    <div class="cover-grid">
      <div class="card"><span class="label">Edition</span><strong>${edition.edition || "—"}</strong><span>${escape(date(edition.date))}</span></div>
      <div class="card"><span class="label">Coverage</span><strong>${features} features</strong><span>${shotCount} screenshots</span></div>
      <div class="card"><span class="label">Devices</span><strong>Desktop &amp; phone</strong><span>1440 × 900 · 390 × 844</span></div>
      <div class="card"><span class="label">Source fingerprint</span><strong class="mono">${escape(edition.fingerprint.slice(0, 12))}</strong><span>Synthetic data; all people are fictional</span></div>
    </div></section>`);
  const contentsAt = pages.length;
  pages.push("");
  const starts: number[] = [];
  let slideNumber = 0;
  chapters.forEach((chapter, c) => {
    starts.push(pages.length + 1);
    pages.push(`<section class="slide chapter" id="chapter-${c + 1}"><div class="number">${c + 1}</div><h1>${escape(chapter.title)}</h1><p>${rich(chapter.summary)}</p>${footer(pages.length + 1)}</section>`);
    for (const item of chapter.slides) pages.push(slideHtml(item, chapter.title, c + 1, pages.length + 1, footer));
  });
  pages[contentsAt] = `<section class="slide contents"><h2>Contents</h2><ol>${chapters
    .map((chapter, c) => `<li><a href="#chapter-${c + 1}"><span class="n">${c + 1}</span><span class="t">${escape(chapter.title)}<small>${chapter.slides.map((s) => escape(s.title)).join(" · ")}</small></span><span class="p">${starts[c]}</span></a></li>`)
    .join("")}</ol>${footer(contentsAt + 1)}</section>`;
  // Media are rendered after numbering because image encoding is asynchronous.
  let mediaNumber = 0;
  for (const chapter of chapters)
    for (const item of chapter.slides) {
      mediaNumber++;
      if (item.kind === "feature") {
        const marker = `<!--media-${mediaNumber}-->`;
        const at = pages.findIndex((p) => p.includes(marker));
        pages[at] = pages[at]!.replace(marker, await mediaHtml(item, assets));
      }
    }
  return `<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><title>Lantern QA manual</title><style>${css}</style></head><body>${pages.join("\n")}</body></html>`;

  function slideHtml(item: Slide, chapterTitle: string, chapterNumber: number, n: number, foot: (n: number) => string) {
    slideNumber++;
    const kicker = `<div class="kicker">${chapterNumber} · ${escape(chapterTitle)}</div>`;
    if (item.kind === "feature")
      return `<section class="slide feature"><header>${kicker}<h2>${escape(item.title)}</h2><div class="roles">${item.roles.map((r) => `<span class="chip">${escape(r)}</span>`).join("")}</div></header>
        <div class="body"><div class="text fit"><div class="card summary"><p>${rich(item.summary)}</p></div>
        <div class="card try"><h3>Try it</h3><ol>${item.tryIt.map((s) => `<li>${rich(s)}</li>`).join("")}</ol></div>
        <div class="card check"><h3>Check</h3><ul>${item.check.map((s) => `<li>${rich(s)}</li>`).join("")}</ul></div></div>
        <div class="media"><!--media-${slideNumber}--></div></div>${foot(n)}</section>`;
    const cards = item.kind === "people"
      ? item.people.map((p) => `<div class="card person"><strong>${escape(p.name)}</strong><span class="chip">${escape(p.role)}</span><p>${rich(p.text)}</p></div>`)
      : (item.kind === "intro" ? item.points : item.items).map((p) => `<div class="card point"><h3>${rich(p.title)}</h3><p>${rich(p.text)}</p></div>`);
    return `<section class="slide grid-slide ${item.kind}"><header>${kicker}<h2>${escape(item.title)}</h2></header><p class="lead fit">${rich(item.lead)}</p><div class="grid fit">${cards.join("")}</div>${foot(n)}</section>`;
  }
}

/** Prints the deck, failing if any slide's text does not fit. */
export async function printPdf(browser: Browser, html: string) {
  const page = await browser.newPage({ viewport: { width: slide.width, height: slide.height } });
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode()));
    });
    const overflowing = await page.$$eval(".slide", (slides) =>
      slides.flatMap((s, i) =>
        [s, ...s.querySelectorAll<HTMLElement>(".fit, .card, figure")].some((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)
          ? [`page ${i + 1}: ${s.querySelector("h1,h2")?.textContent ?? ""}`]
          : [],
      ),
    );
    if (overflowing.length) throw new Error(`Slide content does not fit; shorten the text:\n  ${overflowing.join("\n  ")}`);
    return await page.pdf({ width: slide.width + "px", height: slide.height + "px", printBackground: true, outline: true, tagged: true });
  } finally {
    await page.close();
  }
}

const css = `
@page { size: ${slide.width}px ${slide.height}px; margin: 0 }
* { box-sizing: border-box }
html, body { margin: 0; padding: 0; background: #e9ece6 }
body { font: 15px/1.45 system-ui, sans-serif; color: #18332d; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.slide { width: ${slide.width}px; height: ${slide.height}px; padding: ${slide.padding}px ${slide.padding}px 0; position: relative; overflow: hidden; background: #f5f6f2; page-break-after: always; break-after: page }
.slide > footer { position: absolute; left: ${slide.padding}px; right: ${slide.padding}px; bottom: 0; height: ${slide.footer}px; display: flex; justify-content: space-between; font-size: 11px; color: #6b7d77; border-top: 1px solid #dfe3dc; align-items: center }
header { height: ${slide.header}px; position: relative }
.kicker { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #087f8c; font-weight: 700 }
h2 { font-size: 30px; line-height: 1.15; margin: 6px 0 0; color: #0b2442; max-width: 900px }
.roles { position: absolute; right: 0; top: 0; display: flex; gap: 6px }
.chip { display: inline-block; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 99px; background: #dcefeb; color: #0b5d55 }
.card { background: #fff; border: 1px solid #dfe3dc; border-radius: 14px; padding: 14px 18px; overflow: hidden }
.card h3 { margin: 0 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #087f8c }
.body { display: flex; gap: ${slide.gap}px; height: ${slide.height - slide.padding - slide.header - slide.footer - 16}px }
.text { width: ${slide.text}px; flex: none; display: flex; flex-direction: column; gap: 12px; overflow: hidden }
.summary { background: #0b2442; color: #eef4f2; border: 0; font-size: 16px; line-height: 1.45 }
.summary p { margin: 0 }
.try ol, .check ul { margin: 0; padding-left: 20px; font-size: 14px }
.try li, .check li { margin: 3px 0 }
.check ul { list-style: none; padding-left: 0 }
.check li { padding-left: 24px; position: relative }
.check li::before { content: ""; position: absolute; left: 0; top: 3px; width: 13px; height: 13px; border: 2px solid #087f8c; border-radius: 4px }
.callout { display: inline-block; min-width: 19px; height: 19px; line-height: 19px; border-radius: 10px; background: #f59e0b; color: #111; font-size: 11px; font-weight: 800; text-align: center; vertical-align: 1px }
.summary .callout { color: #111 }
.media { flex: 1; display: flex; flex-direction: column; gap: 16px; align-items: center; justify-content: center }
.row { display: flex; gap: 16px; justify-content: center; align-items: flex-start }
figure { margin: 0; display: flex; flex-direction: column; overflow: visible }
figure img { display: block; border-radius: 10px; border: 1px solid #cfd6cf; box-shadow: 0 6px 18px rgba(11,36,66,.12); background: #fff }
figure img.phone { border-radius: 18px; border: 3px solid #0b2442 }
figcaption { height: 28px; padding-top: 6px; font-size: 11.5px; color: #4d625c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.pending { border: 2px dashed #d08a12; border-radius: 12px; background: #fff8eb; display: flex; flex-direction: column; justify-content: center; gap: 8px; padding: 18px; font-size: 13px; color: #6b4a10 }
.pending strong { font-size: 16px }
.pending code { font-size: 12px; background: #fde9c4; padding: 2px 6px; border-radius: 4px; align-self: flex-start }
.outdated { margin-top: 6px; background: #fde9c4; color: #6b4a10; font-size: 11.5px; padding: 4px 8px; border-radius: 6px }
.cover { background: #0b2442; color: #eef4f2; display: flex; flex-direction: column; justify-content: space-between; padding: 64px }
.cover .brand { font-size: 22px; font-weight: 700; color: #6fd3c9; letter-spacing: .02em }
.cover h1 { font-size: 76px; margin: 8px 0 12px; line-height: 1 }
.cover .lede { font-size: 20px; max-width: 760px; color: #c8d7d3; margin: 0 }
.cover-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px }
.cover .card { background: #12345a; border-color: #1f4874; color: #eef4f2; display: flex; flex-direction: column; gap: 4px; padding: 18px }
.cover .card strong { font-size: 22px }
.cover .card span { color: #b5c8c4; font-size: 13px }
.cover .label { text-transform: uppercase; letter-spacing: .08em; font-size: 11px !important; color: #6fd3c9 !important; font-weight: 700 }
.mono { font-family: ui-monospace, monospace }
.contents h2 { margin-bottom: 20px }
.contents ol { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px }
.contents a { display: flex; gap: 14px; align-items: flex-start; text-decoration: none; color: inherit; background: #fff; border: 1px solid #dfe3dc; border-radius: 14px; padding: 12px 16px; height: 100% }
.contents .n { font-size: 26px; font-weight: 800; color: #087f8c; width: 28px }
.contents .t { flex: 1; font-weight: 700; font-size: 17px; color: #0b2442 }
.contents small { display: block; font-weight: 400; font-size: 12px; color: #4d625c; margin-top: 3px }
.contents .p { font-size: 13px; color: #6b7d77 }
.chapter { background: #0d3b4f; color: #eef4f2; display: flex; flex-direction: column; justify-content: center; padding: 80px }
.chapter .number { font-size: 120px; font-weight: 800; color: #6fd3c9; line-height: 1 }
.chapter h1 { font-size: 54px; margin: 8px 0 16px }
.chapter p { font-size: 21px; max-width: 820px; color: #c8d7d3; margin: 0 }
.chapter footer { color: #9fb6b1; border-color: #24546a }
.grid-slide .lead { font-size: 17px; max-width: 1050px; margin: -8px 0 18px; max-height: 80px; overflow: hidden }
.grid-slide .grid { display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: 1fr; gap: 16px; max-height: 500px; overflow: hidden }
.grid-slide.people .grid { grid-template-columns: repeat(3, 1fr) }
.point { padding: 20px 22px }
.point h3 { text-transform: none; letter-spacing: 0; font-size: 19px; color: #0b2442; margin-bottom: 8px }
.point p, .person p { margin: 0; font-size: 16px; line-height: 1.5 }
.person { display: flex; flex-direction: column; gap: 6px }
.person strong { font-size: 18px; color: #0b2442 }
.person .chip { align-self: flex-start }
`;

