import type { BrowserContextOptions, Locator, Page } from "@playwright/test";

/**
 * Reliable screenshots for the manual. Every capture uses a pinned device,
 * locale, timezone and motion setting; waits for network, fonts and images;
 * and accepts a frame only after two consecutive identical screenshots.
 */
export type Device = "desktop" | "phone";
export const devices = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, isMobile: false, hasTouch: false, label: "Desktop · 1440 × 900" },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, label: "Phone · 390 × 844" },
} as const satisfies Record<Device, BrowserContextOptions & { label: string }>;

export function contextOptions(device: Device): BrowserContextOptions {
  const { label: _label, ...profile } = devices[device];
  return { ...profile, locale: "en-NZ", timezoneId: "Pacific/Auckland", colorScheme: "light", reducedMotion: "reduce", forcedColors: "none" };
}

/** Native controls such as date inputs follow the browser process locale, not the page locale. */
export const launchOptions = {
  env: { ...process.env, LANG: "en_NZ.UTF-8", LANGUAGE: "en_NZ", LC_ALL: "en_NZ.UTF-8" },
};

export type Target = string | ((page: Page) => Locator);
/** Crop each screenshot to an element's box (clamped to the screen), such as the content column or a dialog. */
export interface Crop { crop?: Target; cropPadding?: number }
export type CaptureMode =
  /** The first screen the device shows, or the current scroll position with keepScroll. */
  | ({ kind: "viewport"; keepScroll?: boolean } & Crop)
  /** Successive screens while scrolling the main content, sized to clear fixed bars. */
  | ({ kind: "frames"; container?: string; maxFrames?: number } & Crop)
  /** The viewport extended to the content height, so full-height layouts reach the end. */
  | ({ kind: "tall"; maxHeight?: number } & Crop)
  /** A crop around one element. */
  | { kind: "element"; target: Target; padding?: number };

export interface CaptureFrame {
  image: Buffer;
  scrollTop: number;
  /** CSS pixel size of the captured area. */
  viewport: { width: number; height: number };
}
export class CaptureError extends Error {}

export interface PageWatcher {
  problems(): string[];
  inflight(): number;
}
/** Collects page errors, console errors and failed requests so that broken screens are never published. */
export function watchPage(page: Page, options: { allowStatus?: (status: number, url: string) => boolean } = {}): PageWatcher {
  const problems: string[] = [];
  const pending = new Set<unknown>();
  page.on("pageerror", (error) => problems.push(`Page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !/^Failed to load resource/.test(message.text())) problems.push(`Console error: ${message.text()}`);
  });
  page.on("request", (request) => pending.add(request));
  page.on("requestfinished", (request) => pending.delete(request));
  page.on("requestfailed", (request) => {
    pending.delete(request);
    if (request.failure()?.errorText !== "net::ERR_ABORTED") problems.push(`Request failed: ${request.url()} ${request.failure()?.errorText}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !options.allowStatus?.(response.status(), response.url()))
      problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  return { problems: () => [...problems], inflight: () => pending.size };
}

const stillStyle = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;
transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important;scroll-behavior:auto!important}`;
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

interface Options {
  watcher: PageWatcher;
  highlight?: Target[];
  stableTimeoutMs?: number;
}

function assertHealthy(watcher: PageWatcher) {
  const problems = watcher.problems();
  if (problems.length) throw new CaptureError(problems.join("\n"));
}

async function quiet(page: Page, watcher: PageWatcher, deadline: number) {
  let quietSince = Date.now();
  while (Date.now() - quietSince < 250) {
    if (watcher.inflight() > 0) quietSince = Date.now();
    if (Date.now() > deadline) throw new CaptureError(`The screen did not settle: ${watcher.inflight()} requests still pending.`);
    await sleep(25);
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => (image.complete ? undefined : image.decode().catch(() => undefined))));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

const resolveTarget = (page: Page, target: Target) => (typeof target === "string" ? page.locator(target) : target(page)).first();

async function cropClip(page: Page, mode: Crop) {
  if (!mode.crop) return undefined;
  const box = await resolveTarget(page, mode.crop).boundingBox();
  if (!box) throw new CaptureError("The crop target is not visible.");
  const screen = page.viewportSize()!, padding = mode.cropPadding ?? 24;
  const x = Math.max(0, Math.floor(box.x - padding)), y = Math.max(0, Math.floor(box.y - padding));
  const right = Math.min(screen.width, Math.ceil(box.x + box.width + padding)), bottom = Math.min(screen.height, Math.ceil(box.y + box.height + padding));
  return { x, y, width: right - x, height: bottom - y };
}
const area = (clip: { width: number; height: number } | undefined, fallback: { width: number; height: number }) =>
  clip ? { width: clip.width, height: clip.height } : fallback;

async function drawHighlights(page: Page, highlight: Target[] = []) {
  const boxes = [];
  for (const target of highlight) boxes.push(await resolveTarget(page, target).boundingBox());
  await page.evaluate((boxes) => {
    document.getElementById("manual-callouts")?.remove();
    if (!boxes.length) return;
    const layer = document.createElement("div");
    layer.id = "manual-callouts";
    layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
    boxes.forEach((box, index) => {
      // Skip controls scrolled out of this frame rather than pinning their badge to an edge.
      if (!box || box.y + box.height <= 0 || box.y >= innerHeight || box.x + box.width <= 0 || box.x >= innerWidth) return;
      const ring = document.createElement("div");
      ring.style.cssText = `position:absolute;left:${box.x - 5}px;top:${box.y - 5}px;width:${box.width + 10}px;height:${box.height + 10}px;border:3px solid #f59e0b;border-radius:10px;box-shadow:0 0 0 4px rgba(245,158,11,.25)`;
      const badge = document.createElement("div");
      badge.textContent = String(index + 1);
      badge.style.cssText = `position:absolute;left:${Math.max(2, box.x - 16)}px;top:${Math.max(2, box.y - 16)}px;width:26px;height:26px;border-radius:13px;background:#f59e0b;color:#111;font:700 15px/26px system-ui,sans-serif;text-align:center`;
      layer.append(ring, badge);
    });
    document.body.append(layer);
  }, boxes);
}

/** Two consecutive identical screenshots, or a CaptureError. */
async function stableShot(page: Page, options: Options, clip?: { x: number; y: number; width: number; height: number }) {
  const deadline = Date.now() + (options.stableTimeoutMs ?? 8000);
  const take = async () => {
    await quiet(page, options.watcher, deadline);
    await drawHighlights(page, options.highlight);
    return page.screenshot({ animations: "disabled", caret: "hide", scale: "device", clip });
  };
  let previous = await take();
  while (Date.now() < deadline) {
    await sleep(120);
    const next = await take();
    if (next.equals(previous)) {
      assertHealthy(options.watcher);
      return next;
    }
    previous = next;
  }
  throw new CaptureError("The screen did not settle: consecutive screenshots kept changing.");
}

interface ScrollPlan {
  scrollHeight: number;
  client: number;
  top: number;
  bottom: number;
  document: boolean;
}
async function planScroll(page: Page, container?: string): Promise<ScrollPlan> {
  const plan = await page.evaluate((selector) => {
    document.getElementById("manual-callouts")?.remove();
    document.querySelector("[data-manual-scroller]")?.removeAttribute("data-manual-scroller");
    const root = document.scrollingElement as HTMLElement;
    const scrolls = (element: Element) =>
      /(auto|scroll|overlay)/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1 && element.getClientRects().length > 0;
    let target: HTMLElement | null = selector ? document.querySelector<HTMLElement>(selector) : null;
    if (selector && !target) return { error: `No element matches ${selector}.` };
    if (!target)
      target = root.scrollHeight > innerHeight + 1 ? root
        : [...document.querySelectorAll<HTMLElement>("body *")].filter(scrolls).sort((a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight))[0] ?? root;
    target.setAttribute("data-manual-scroller", "");
    const isDocument = target === root;
    const region = isDocument ? { top: 0, bottom: innerHeight } : target.getBoundingClientRect();
    const client = isDocument ? innerHeight : target.clientHeight;
    const max = target.scrollHeight - client;
    // Sticky elements only stick once scrolled, so measure bars part-way down.
    target.scrollTop = Math.round(max / 2);
    let top = 0, bottom = 0;
    for (const element of document.querySelectorAll<HTMLElement>("body *")) {
      const position = getComputedStyle(element).position;
      if (position !== "fixed" && position !== "sticky") continue;
      if (!isDocument && position === "fixed") continue;
      if (!isDocument && !target.contains(element)) continue;
      const rect = element.getBoundingClientRect();
      if (!rect.height || rect.height > client / 2 || rect.bottom <= region.top || rect.top >= region.bottom) continue;
      if (rect.top <= region.top + 2) top = Math.max(top, rect.bottom - region.top);
      else if (rect.bottom >= region.bottom - 2) bottom = Math.max(bottom, region.bottom - rect.top);
    }
    target.scrollTop = 0;
    return { scrollHeight: target.scrollHeight, client, top: Math.ceil(top), bottom: Math.ceil(bottom), document: isDocument };
  }, container);
  if ("error" in plan) throw new CaptureError(plan.error);
  return plan as ScrollPlan;
}

async function scrollTo(page: Page, position: number) {
  const actual = await page.evaluate((y) => {
    const target = document.querySelector<HTMLElement>("[data-manual-scroller]")!;
    target.scrollTop = y;
    return target.scrollTop;
  }, position);
  if (Math.abs(actual - position) > 1) throw new CaptureError(`Could not scroll to ${position}px (stopped at ${actual}px).`);
}

/** The fewest evenly spaced scroll positions that show all content clear of fixed bars, with overlap for context. */
export function framePositions(plan: Pick<ScrollPlan, "scrollHeight" | "client" | "top" | "bottom">) {
  const max = Math.max(0, plan.scrollHeight - plan.client);
  const overlap = Math.max(48, Math.round(plan.client * 0.08));
  const step = plan.client - plan.top - plan.bottom - overlap;
  if (max > 0 && step < plan.client * 0.3) throw new CaptureError("Fixed bars cover too much of the screen to scroll through it.");
  const count = max > 0 ? Math.ceil(max / step) + 1 : 1;
  return Array.from({ length: count }, (_, i) => (count === 1 ? 0 : Math.round((max * i) / (count - 1))));
}

export async function capture(page: Page, mode: CaptureMode, options: Options): Promise<CaptureFrame[]> {
  assertHealthy(options.watcher);
  // Tooling may wrap functions passed to page.evaluate with a module helper; define it in the page.
  await page.evaluate("globalThis.__name ??= (fn) => fn");
  await page.addStyleTag({ content: stillStyle });
  const viewport = page.viewportSize()!;
  if (mode.kind === "viewport") {
    if (!mode.keepScroll) await page.evaluate(() => window.scrollTo(0, 0));
    const clip = await cropClip(page, mode);
    const image = await stableShot(page, options, clip);
    return [{ image, scrollTop: await page.evaluate(() => document.scrollingElement!.scrollTop), viewport: area(clip, viewport) }];
  }
  if (mode.kind === "element") {
    const target = resolveTarget(page, mode.target);
    await target.scrollIntoViewIfNeeded();
    await quiet(page, options.watcher, Date.now() + (options.stableTimeoutMs ?? 8000));
    const box = await target.boundingBox();
    if (!box) throw new CaptureError("The element to capture is not visible.");
    const padding = mode.padding ?? 16;
    const x = Math.max(0, Math.floor(box.x - padding)), y = Math.max(0, Math.floor(box.y - padding));
    const clip = { x, y, width: Math.min(viewport.width - x, Math.ceil(box.width + padding * 2)), height: Math.min(viewport.height - y, Math.ceil(box.height + padding * 2)) };
    if (box.height + padding * 2 > viewport.height) throw new CaptureError("The element is taller than the screen; use frames or a tall capture.");
    return [{ image: await stableShot(page, options, clip), scrollTop: 0, viewport: { width: clip.width, height: clip.height } }];
  }
  if (mode.kind === "tall") {
    const limit = mode.maxHeight ?? 4000;
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const height = await page.evaluate(() => document.scrollingElement!.scrollHeight);
        const current = page.viewportSize()!.height;
        if (height <= current) break;
        if (height > limit) throw new CaptureError(`The page is ${height}px tall; tall captures allow ${limit}px. Use frames.`);
        await page.setViewportSize({ width: viewport.width, height });
        await quiet(page, options.watcher, Date.now() + (options.stableTimeoutMs ?? 8000));
      }
      const size = page.viewportSize()!;
      const clip = await cropClip(page, mode);
      return [{ image: await stableShot(page, options, clip), scrollTop: 0, viewport: area(clip, size) }];
    } finally {
      await page.setViewportSize(viewport);
    }
  }
  const plan = await planScroll(page, mode.container);
  const positions = framePositions(plan);
  const maxFrames = mode.maxFrames ?? 4;
  if (positions.length > maxFrames)
    throw new CaptureError(`The content needs ${positions.length} frames; at most ${maxFrames} are allowed. Split the scene or raise maxFrames.`);
  const frames: CaptureFrame[] = [];
  try {
    for (const position of positions) {
      await scrollTo(page, position);
      const clip = await cropClip(page, mode);
      frames.push({ image: await stableShot(page, options, clip), scrollTop: position, viewport: area(clip, viewport) });
    }
  } finally {
    await scrollTo(page, 0).catch(() => undefined);
  }
  return frames;
}

