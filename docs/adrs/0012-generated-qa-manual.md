# Generated QA manual

Date: 2026-10-30
Status: Proposed

## Decision

Keep a QA manual as a generated PDF slide deck in the repository, with its screenshots and a manifest under `docs/manual`. A local command builds the client and runs scripted scenes against a disposable synthetic database. It photographs each scene on pinned device profiles and renders HTML slides to PDF with Chromium. The manifest records hashes of product source, screenshots, supplied captures and the PDF. A browser-free CI check fails when the manual no longer matches the source. Each new edition merged to main is published as a GitHub release.

## Rationale and alternatives

QA needs one current, versioned document showing how every feature looks and behaves. Hand-maintained documents in Google Drive drift from the product, and GitHub issues are poor reading material. Regenerating screenshots in CI would need a database, a browser and a font environment on every pull request. Committing the generated output keeps CI fast and makes each edition reviewable in its pull request. The cost is binary churn in Git history and merge conflicts on generated files, which are resolved by regenerating.

## Consequences

Any change to product source requires running `npm run manual` before merge. The manual is a separate fixture from staging acceptance ([ADR 0006](0006-authenticated-release-acceptance.md)); its scenes are not a test suite and do not replace browser tests. Screens outside the synthetic world, such as Google sign-in, are captured by a person and flagged when their source files change.

