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

Commit everything under `docs/manual`. `npm run manual` builds the client into a temporary folder and starts a disposable synthetic database. It photographs every scene and rewrites only the screenshots whose pixels changed. It renders a new edition only when the deck content changed. An unchanged rerun reports `0 screenshot(s) changed` and keeps the current edition.

`npm run manual:check` needs no browser or database. It fails when:

- a product source file changed after generation (it lists the files);
- a screenshot, supplied capture or the PDF differs from the manifest;
- a screenshot is missing or not recorded.

Product source means `client/`, `shared/`, `server/`, `public/`, `index.html`, `vite.config.ts`, [PRD.md](../PRD.md) and the manual tooling. Tests and test support files are excluded. [isProductSource](../../tools/manual/freshness.ts) defines the exact rule.

When two branches both regenerate, the manual files conflict. Resolve the conflict by merging the source changes, then running `npm run manual` again; never merge the generated files by hand.

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

Fonts are system fonts, so screenshots from another operating system differ slightly. Regenerate on the same Linux environment where practical.

## Supplied captures

Screens the synthetic world cannot reach, such as Google's own sign-in pages, are supplied by a person. Each supplied capture lists the source files it depends on. Until it is supplied, the slide shows a placeholder and the check prints a warning.

To supply or replace a capture, save the PNG named on the slide in [docs/manual/supplied](../manual/supplied/), then run `npm run manual`. When one of its source files changes, the slide marks the capture as possibly outdated and the check warns. Replace the image, or confirm it still matches with `npm run manual -- --confirm=<id>`.

## Releases

On every push to main that changes [manifest.json](../manual/manifest.json), the [QA manual release workflow](../../.github/workflows/manual.yml) checks that the manual is fresh. It then publishes `manual-<edition>` with the PDF attached, marked as the latest release. An edition that is already published is skipped. The stable "latest" link works only while manual editions are the repository's only releases marked latest.

