# QA manual

The QA manual is a PDF slide deck for testers. Each feature gets one slide covering what it does, how to try it, what to check, and screenshots of the real application. Generation happens locally at build time. The deck, its screenshots and a manifest are committed under [docs/manual](../manual/). A fast CI check fails when product source changes but the manual was not regenerated.

QA can always open the latest edition at <https://github.com/JesusFilm/lantern/releases/latest/download/lantern-manual.pdf>. Each edition is also browsable in the repository at [docs/manual/lantern-manual.pdf](../manual/lantern-manual.pdf).

For human testers' accounts and resetting staging examples, see [QA staging](../operations/qa-staging.md). The fictional screenshot identities are local fixtures, not staging logins.

## Regenerate after changing the product

The agent or developer making the change owns the manual update. Before finishing
the change:

1. Compare each changed user-visible behavior, role, workflow, validation and
   failure state with the existing slides and capture scenes. Use the product
   requirements and implementation to establish expected behavior.
2. Update or add slides so their descriptions, steps and checks cover the
   change. Update the capture scenes and synthetic data to show affected UI
   states; identify screens that require a supplied capture.
3. Regenerate the manual using the commands below. Inspect affected screenshots
   and rendered PDF pages for accurate content, legibility, scroll coverage and
   callouts. Correct any issues and regenerate again.
4. Run the freshness check and include the manual changes with the product
   change. Report any missing supplied captures or checks that could not be
   verified.

The CI freshness check verifies that the recorded files match the source; it
does not assess whether the manual covers the behavior or whether its wording
and screenshots are correct. The person or coding agent making the change
performs that assessment as part of the work.

```sh
docker compose --env-file .env.example up -d --wait database
npm run manual
npm run manual:check
```

Commit everything under `docs/manual`. `npm run manual` builds the client into a temporary folder and starts a disposable synthetic database. It photographs every scene and rewrites only the screenshots whose pixels changed. It renders a new edition when the deck content changed or the existing PDF is missing or mismatched. An unchanged rerun with a valid PDF reports `0 screenshot(s) changed` and keeps the current edition.

`npm run manual:check` needs no browser or database. It fails when:

- a product source file changed after generation (it lists the files);
- a screenshot, supplied capture or the PDF differs from the manifest;
- a screenshot is missing or not recorded.

Product source means `client/`, `shared/`, `server/`, `public/`, `index.html`, `vite.config.ts`, Node and dependency configuration, [PRD.md](../PRD.md) and the manual tooling. Tests and test support files are excluded, except `server/privilege-test-support.ts`, which the manual world imports. The rendering fixture configuration (`.env.example`, Compose and TypeScript configuration) is included. [isProductSource](../../tools/manual/freshness.ts) defines the exact rule.

Dependency inputs are normalized JSON. Only the explicit type-only development packages `@types/node`, `@types/express`, `@types/pg`, `@types/react` and `@types/react-dom` are omitted when their lock entries are development-only, have no install script and are not runtime/optional/peer dependencies of the root. `undici-types` is omitted only when no retained package or root depends on it. Package scripts, install scripts, Node, runtime dependencies, Vite and its React plugin, Playwright, Sharp, TypeScript, TSX and unknown packages remain relevant. Version 2, malformed or unsupported lockfiles retain byte-level detection; the whole lockfile is never excluded.

The manifest separates `sources` (the normalized freshness inputs) from `verification` (the raw input hashes and time of the last successful full generation). An irrelevant type-only update can pass without generation: the recorded `verification.generatedAt` and raw hashes intentionally remain unchanged. A full successful capture updates provenance; it preserves the PDF and edition when content and images are unchanged. The freshness check never claims or records that generation occurred.

When two branches both regenerate, the manual files conflict. Resolve the conflict by taking main's generated files as the starting point, then running `npm run manual` again; never merge the generated files by hand. The edition must move forward from main's: the release workflow tags `manual-<edition>` once and never republishes a tag, so if the branch's deck differs from main's, generating from the branch's own old manifest would keep main's edition number under a different PDF and the new deck would never reach QA's "latest" link. Starting from main's generated files makes `npm run manual` compare against main's deck and render the next edition. CI fetches main and its history and fails if it cannot compare editions. Push checks compare against the revision before the whole push and reject an outdated main revision, and the release workflow checks main again immediately before publication. A changed deck must advance beyond main's edition; a branch whose manual is unchanged since its common ancestor is allowed to be behind. Local checks use the same comparison when main is available.

## Appearance coverage

The manual documents the Light, Dark and System setting, but its application screenshots are generated in light mode only. A separate dark-mode manual is deliberately excluded: dark mode changes presentation, not the workflows the manual describes. Review dark appearance separately when styles change.

## Write or change a slide

Slides live in [content.ts](../../tools/manual/content.ts), together with the scenes that photograph them. A scene names a synthetic person, a device and a path. It lists the interactions that reach the state, a `ready` locator that must be visible, and a capture mode. Numbered `highlight` targets draw callouts. Reference them in the slide text as ①, ②, and so on. Generation fails when slide text does not fit, so keep Try it and Check lists to about four short lines each.

Use `npm run manual -- --only=scene-id,…` while iterating. It writes previews to `output/manual-preview` and leaves the manual untouched.

The synthetic world in [world.ts](../../tools/manual/world.ts) seeds people, departments, initiatives, focuses, review requests and notes through the public HTTP API, then pins the stored timestamps. The coach is a fixed fake, so AI screens are repeatable. Scenes that save data set `mutates: true`; the world is rebuilt after them.

## Reliable screenshots

[capture.ts](../../tools/manual/capture.ts) pins each capture to a device profile: desktop is 1440 × 900 and phone is 390 × 844, both at 2× density. It also pins the New Zealand locale and timezone, the browser process locale (so native date fields are formatted the same way), reduced motion and a fixed clock.

Before taking a screenshot, it waits until there are no outstanding requests and fonts and images have loaded. It then requires two consecutive identical screenshots. A screen that keeps changing fails instead of producing an arbitrary image. Page errors, console errors and failed requests also fail the scene. When any scene fails, nothing is written.

Choose the capture mode by what the reader needs to see:

| Mode | Use for |
| --- | --- |
| `viewport` (default) | The first screen of a page or a modal dialog. Starts from the top of the page. |
| `frames` | Content longer than the screen, including scrolling dialog bodies. Each frame is a real screen at an evenly spaced scroll position. Fixed headers and bottom bars stay where users see them, and the steps overlap so nothing is hidden behind a bar. Generation fails rather than truncating when more than `maxFrames` would be needed. |
| `tall` | A full-height layout extended to the content height. A plain full-page screenshot would cut off fixed sidebars. |
| `element` | A crop around one control or panel. |

Add `crop` to the `viewport`, `frames` or `tall` modes to keep the text legible on a slide. Long desktop pages use frames cropped to `.workspace`; dialogs crop to `role=dialog`.

## Rendering environment

Screenshots are pixel-compared, and the manual uses system fonts (`system-ui`, `sans-serif`, `Georgia, serif`, `ui-monospace`). A machine with different fonts shifts line breaks and fails the slide-fit check, or rewrites every screenshot. Regenerate only where the environment below holds. The tooling pins the device profiles, locale, timezone, clock and motion; the rest is your machine.

| Requirement | Value |
| --- | --- |
| Node | the version in [.nvmrc](../../.nvmrc) |
| Playwright and Chromium | the `@playwright/test` version in the lockfile (1.64.1, Chromium 156.0.8078.4 when this was written), installed with `npx playwright install chromium` |
| Linux | Debian/Ubuntu-style fontconfig (2.14); other operating systems render differently |
| `system-ui`, `sans-serif` | Noto Sans (Regular and Bold) |
| `Georgia, serif` | Liberation Serif, not Noto Serif. Chromium picks this itself, so `fc-match Georgia` is not a reliable test |
| `ui-monospace, monospace` | DejaVu Sans Mono |
| Emoji | Noto Color Emoji |
| Network | the app and the browser talk over loopback. When a proxy is configured through `HTTP_PROXY` and `NODE_USE_ENV_PROXY=1`, set `NO_PROXY=127.0.0.1,localhost`; otherwise generation fails with `fetch failed` |

These font files reproduced the committed screenshots exactly (0 of 44 changed) on 3 November 2026:

| Face | SHA-256 |
| --- | --- |
| NotoSans-Regular.ttf | `89c3c497f618fdaa0b2d1e98fef93582f28c71debd2c4a8cdf41f190ced2909d` |
| NotoSans-Bold.ttf | `e83493c945848ecd4a9ad0f6d19164541a0d3e23a9c952304a00a46e00272ac5` |
| LiberationSerif-Regular.ttf | `350f4ffd773cae53560c63dca3d89a5070595614fde12f772bf43feb63d81064` |
| LiberationSerif-Bold.ttf | `bb033fae52dcbf67a55494a08829aaa788324624d72a195af7f93da3061c928f` |
| DejaVuSansMono.ttf | `a54dca07c76d6289e717e75e0a58c0128f6d7269ef3faf76417c9d7d3bba37ab` |
| DejaVuSansMono-Bold.ttf | `2d67eed9b325ee2e69f906ce4f3f6264d5105230a13352c8494daad4f17b12c8` |
| NotoColorEmoji.ttf | `9fd0a3d0ce84d77e3185dfbae77bd1abf3926aa49a032e354d076c4f17151f10` |

To see which faces Chromium actually uses, ask it:

```sh
cat > fonts-probe.mjs <<'JS'
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
const cases = [['system-ui, sans-serif', 400], ['Georgia, serif', 400], ['ui-monospace, monospace', 400], ['system-ui, sans-serif', 700]];
await page.setContent(cases.map(([f, w], i) => `<p id="p${i}" style="font-family:${f};font-weight:${w}">Hello</p>`).join(''));
const cdp = await page.context().newCDPSession(page);
await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
const { root } = await cdp.send('DOM.getDocument');
for (const [i, [f, w]] of cases.entries()) {
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#p' + i });
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  console.log(f, w, '->', fonts.map((x) => x.postScriptName).join(', '));
}
await browser.close();
JS
node fonts-probe.mjs; rm fonts-probe.mjs
```

Expect `NotoSans-Regular`, `LiberationSerif`, `DejaVuSansMono` and `NotoSans-Bold`.

**Acceptance test.** On an unmodified checkout of `main`, `npm run manual` must report `0 screenshot(s) changed` and `The deck is unchanged`. If it rewrites screenshots or fails the slide-fit check, the environment is wrong. Do not commit the output. Fix the fonts first (the probe above shows what Chromium chose) and repeat. When screenshots change after a product change, inspect each changed image and the matching PDF page and confirm the difference is intended before committing. A product source change requires successful generation. A changed deck or a missing or mismatched PDF issues a new edition. The cover does not contain the source fingerprint.

## Supplied captures

Screens the synthetic world cannot reach, such as Jesus Film Auth's sign-in pages, are supplied by a person. Each supplied capture lists the source files it depends on. Until it is supplied, the slide shows a placeholder and the check prints a warning.

To supply or replace a capture, save the PNG named on the slide in [docs/manual/supplied](../manual/supplied/), then run `npm run manual`. When one of its source files changes, the slide marks the capture as possibly outdated and the check warns. Replace the image, or confirm it still matches with `npm run manual -- --confirm=<id>`.

## Releases

On every push to main, the [QA manual release workflow](../../.github/workflows/manual.yml) checks that the manual is fresh. It then publishes `manual-<edition>` with the PDF attached, marked as the latest release. CI and the release workflow compare an existing release or tag to the current deck, and verify a published PDF's digest against its tagged manifest, so a reused edition or missing or replaced PDF fails even after a later unrelated push. If an upload or publication fails and leaves a draft, rerunning the workflow verifies its target commit and any existing tag before replacing the draft's PDF and publishing it. The stable "latest" link works only while manual editions are the repository's only releases marked latest.

If the current push introduces a new edition, unpublished intermediate commits may contain earlier drafts of its deck. If another push arrives before an edition is published, the current main run verifies first-parent history back to an earlier edition. Every intervening revision of the unpublished edition must contain the same deck. Missing history or a conflicting deck fails closed; verify the intended edition and recover its draft or tag, or generate a new edition. A rerun of the original workflow can proceed while its commit is still current main.

