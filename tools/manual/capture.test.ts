import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, type Browser } from "@playwright/test";
import { capture, contextOptions, watchPage } from "./capture.js";

let browser: Browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function open(html: string, size = { width: 400, height: 800 }) {
  const context = await browser.newContext({ ...contextOptions("desktop"), viewport: size, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const watcher = watchPage(page);
  await page.setContent(html);
  return { page, watcher, close: () => context.close() };
}
const rows = (n: number) => Array.from({ length: n }, (_, i) => `<p class="row" id="r${i}" style="height:40px;margin:0">Row ${i}</p>`).join("");

/** Every row must be fully visible, clear of fixed bars, in at least one frame. */
async function assertCovered(page: import("@playwright/test").Page, frames: Awaited<ReturnType<typeof capture>>, container: string | undefined, bars: { top: number; bottom: number }) {
  const geometry = await page.evaluate((selector) => {
    const scroller = selector ? document.querySelector(selector)! : document.scrollingElement!;
    const origin = selector ? scroller.getBoundingClientRect().top : 0;
    scroller.scrollTop = 0;
    return { client: selector ? scroller.clientHeight : innerHeight, origin, rows: [...scroller.querySelectorAll(".row")].map((row) => { const r = row.getBoundingClientRect(); return { id: row.id, top: r.top - origin, bottom: r.bottom - origin }; }) };
  }, container);
  for (const row of geometry.rows) {
    const seen = frames.some((frame) => row.top - frame.scrollTop >= bars.top && row.bottom - frame.scrollTop <= geometry.client - bars.bottom);
    assert.ok(seen, `${row.id} is never fully visible clear of the fixed bars`);
  }
}

test("frames step through a long document without hiding content under fixed bars", async () => {
  const { page, watcher, close } = await open(`<body style="margin:0">
    <header style="position:fixed;top:0;left:0;right:0;height:60px;background:#123">Header</header>
    <main style="padding:60px 0 80px">${rows(50)}</main>
    <nav style="position:fixed;bottom:0;left:0;right:0;height:80px;background:#456">Previous / Next</nav></body>`);
  try {
    const frames = await capture(page, { kind: "frames" }, { watcher });
    assert.ok(frames.length >= 3 && frames.length <= 6, `unexpected frame count ${frames.length}`);
    assert.equal(frames[0]!.scrollTop, 0);
    const max = await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight);
    assert.equal(frames.at(-1)!.scrollTop, max, "the last frame reaches the end of the page");
    await assertCovered(page, frames, undefined, { top: 60, bottom: 80 });
    assert.equal(new Set(frames.map((f) => f.image.toString("base64"))).size, frames.length, "frames show different content");
  } finally { await close(); }
});

test("frames scroll the inner container that holds the content, such as a dialog body", async () => {
  const { page, watcher, close } = await open(`<body style="margin:0;overflow:hidden">
    <div role="dialog" style="position:fixed;inset:40px;display:flex;flex-direction:column;background:#eee">
      <h2 style="margin:0;height:50px">Dialog</h2>
      <div class="body" style="flex:1;overflow-y:auto">${rows(40)}</div>
      <footer style="height:50px">Save</footer></div></body>`);
  try {
    const frames = await capture(page, { kind: "frames" }, { watcher });
    assert.ok(frames.length >= 2, "the dialog body was scrolled");
    await assertCovered(page, frames, ".body", { top: 0, bottom: 0 });
  } finally { await close(); }
});

test("frames refuse to silently truncate content that needs more than the allowed frames", async () => {
  const { page, watcher, close } = await open(`<body style="margin:0">${rows(200)}</body>`);
  try {
    await assert.rejects(capture(page, { kind: "frames", maxFrames: 3 }, { watcher }), /needs \d+ frames; at most 3/);
  } finally { await close(); }
});

test("tall captures extend full-height layouts such as a fixed sidebar to the end of the content", async () => {
  const { page, watcher, close } = await open(`<body style="margin:0">
    <aside style="position:fixed;top:0;bottom:0;left:0;width:100px;background:rgb(10,20,30)"></aside>
    <main style="margin-left:100px">${rows(40)}</main></body>`);
  try {
    const [frame] = await capture(page, { kind: "tall" }, { watcher });
    assert.equal(frame!.viewport.height, 1600);
    const pixel = await page.evaluate(async (data) => {
      const img = new Image(); img.src = "data:image/png;base64," + data; await img.decode();
      const canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height;
      const g = canvas.getContext("2d")!; g.drawImage(img, 0, 0);
      return [img.height, ...g.getImageData(10, img.height - 5, 1, 1).data.slice(0, 3)];
    }, frame!.image.toString("base64"));
    assert.deepEqual(pixel, [1600, 10, 20, 30], "the sidebar reaches the bottom of the tall capture");
    assert.deepEqual(page.viewportSize(), { width: 400, height: 800 }, "the original viewport is restored");
  } finally { await close(); }
});

test("frames can be cropped to the content column while still scrolling the page", async () => {
  const { page, watcher, close } = await open(`<body style="margin:0">
    <aside style="position:fixed;top:0;bottom:0;left:0;width:150px;background:#123"></aside>
    <main class="content" style="margin-left:200px;width:150px">${rows(40)}</main></body>`);
  try {
    const frames = await capture(page, { kind: "frames", crop: ".content", cropPadding: 10 }, { watcher });
    assert.ok(frames.length >= 2);
    for (const frame of frames) assert.deepEqual(frame.viewport, { width: 170, height: 800 });
    await assertCovered(page, frames, undefined, { top: 0, bottom: 0 });
  } finally { await close(); }
});

test("element captures crop around the target with padding", async () => {
  const { page, watcher, close } = await open(`<body style="margin:0"><div style="height:300px"></div><section id="card" style="width:200px;height:100px;margin-left:50px;background:#abc">Card</section></body>`);
  try {
    const [frame] = await capture(page, { kind: "element", target: "#card", padding: 10 }, { watcher });
    assert.deepEqual(frame!.viewport, { width: 220, height: 120 });
  } finally { await close(); }
});

test("a screen that keeps changing fails instead of producing an arbitrary screenshot", async () => {
  const { page, watcher, close } = await open(`<body><p id="t">0</p><script>let n=0;setInterval(()=>t.textContent=String(++n),30)</script></body>`);
  try {
    await assert.rejects(capture(page, { kind: "viewport" }, { watcher, stableTimeoutMs: 1500 }), /did not settle/);
  } finally { await close(); }
});

test("content that arrives after a delayed request is captured once it has settled", async () => {
  const { page, watcher, close } = await open(`<body><p id="t">Loading…</p></body>`);
  try {
    await page.route("**/late", async (route) => { await new Promise((r) => setTimeout(r, 400)); await route.fulfill({ body: "Loaded content", headers: { "access-control-allow-origin": "*" } }); });
    await page.evaluate(() => { void fetch("https://manual.invalid/late").then((r) => r.text()).then((t) => { document.getElementById("t")!.textContent = t; }); });
    const [frame] = await capture(page, { kind: "viewport" }, { watcher });
    assert.equal(await page.textContent("#t"), "Loaded content");
    assert.ok(frame!.image.length > 0);
  } finally { await close(); }
});

test("page errors and failed requests make the capture fail", async () => {
  const { page, watcher, close } = await open(`<body><p>Fine</p></body>`);
  try {
    await page.evaluate(() => setTimeout(() => { throw new Error("boom in the page"); }));
    await page.waitForTimeout(50);
    await assert.rejects(capture(page, { kind: "viewport" }, { watcher }), /boom in the page/);
  } finally { await close(); }
});

test("animations and the text caret do not vary between captures", async () => {
  const { page, watcher, close } = await open(`<body><style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    <div style="width:40px;height:40px;background:red;animation:spin 1s linear infinite"></div><input autofocus value="text"></body>`);
  try {
    const first = await capture(page, { kind: "viewport" }, { watcher });
    await page.waitForTimeout(170);
    const second = await capture(page, { kind: "viewport" }, { watcher });
    assert.ok(first[0]!.image.equals(second[0]!.image));
  } finally { await close(); }
});

