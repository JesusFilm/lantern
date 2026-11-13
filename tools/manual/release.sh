#!/usr/bin/env bash
set -euo pipefail

git fetch --no-tags origin +refs/heads/main:refs/remotes/origin/main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse refs/remotes/origin/main)" ]; then
  echo "The manual release is no longer current main; refusing to publish a stale latest release." >&2
  exit 1
fi
edition=$(node -p "require('./docs/manual/manifest.json').edition")
date=$(node -p "require('./docs/manual/manifest.json').editionDate")
tag="manual-$edition"
check_edition() {
  git show "$1:docs/manual/manifest.json" | node -e '
    const fs = require("node:fs");
    const published = JSON.parse(fs.readFileSync(0, "utf8"));
    const current = require("./docs/manual/manifest.json");
    if (published.edition !== current.edition || typeof published.deck !== "string" || published.deck !== current.deck) {
      console.error("The existing manual edition has different content; generate a new edition.");
      process.exit(1);
    }
  '
}
check_existing_tag() {
  remote_tag=$(git ls-remote --tags --refs origin "refs/tags/$tag")
  if [ -n "$remote_tag" ]; then
    git fetch origin "refs/tags/$tag:refs/tags/$tag"
    check_edition "$tag"
  fi
}
lookup_error=$(mktemp)
notes_file=$(mktemp)
trap 'rm -f "$lookup_error" "$notes_file"' EXIT
write_notes() {
  local target=$1 target_date
  target_date=$(git show "$target:docs/manual/manifest.json" | node -e 'let s=""; process.stdin.on("data",c=>s+=c).on("end",()=>process.stdout.write(JSON.parse(s).editionDate));')
  printf 'Lantern QA manual, edition %s (%s), generated from %s.\n\nOpen lantern-manual.pdf below. Screenshots use synthetic data.\n\n' "$edition" "$target_date" "$target" > "$notes_file"
  node tools/manual/_release-notes.mjs --release "$target" >> "$notes_file"
}
if draft=$(gh release view "$tag" --json isDraft --jq '.isDraft' 2>"$lookup_error"); then
  if [ "$draft" = "true" ]; then
    # Drafts may not yet have a Git tag; gh create recorded the
    # exact target commit and we require that immutable identity.
    ref=$(gh release view "$tag" --json targetCommitish --jq '.targetCommitish')
    if ! [[ "$ref" =~ ^[[:xdigit:]]{40}$ ]]; then
      echo "Cannot verify the draft manual edition's target commit." >&2
      exit 1
    fi
  else
    git fetch origin "refs/tags/$tag:refs/tags/$tag"
    ref="$tag"
  fi
  # A later unrelated push must not hide invalid edition reuse.
  check_edition "$ref"
  if [ "$draft" = "true" ]; then
    # A draft can also name a pre-existing tag, whose commit takes
    # precedence over targetCommitish when GitHub publishes it.
    check_existing_tag
    if [ "${1:-}" = "--check" ]; then exit 0; fi
    # Resume an incomplete upload only after validating its target.
    write_notes "$ref"
    gh release upload "$tag" docs/manual/lantern-manual.pdf --clobber
    gh release edit "$tag" --draft=false --latest --notes-file "$notes_file"
  else
    expected_pdf=$(git show "$ref:docs/manual/manifest.json" | node -e '
      const fs = require("node:fs");
      const {pdf} = JSON.parse(fs.readFileSync(0, "utf8"));
      if (typeof pdf !== "string" || !/^[a-f0-9]{64}$/.test(pdf)) process.exit(1);
      process.stdout.write(pdf);
    ')
    gh release view "$tag" --json assets | node -e '
      const fs = require("node:fs");
      const {assets} = JSON.parse(fs.readFileSync(0, "utf8"));
      const matches = Array.isArray(assets) ? assets.filter(a => a.name === "lantern-manual.pdf") : [];
      if (matches.length !== 1 || matches[0].digest !== `sha256:${process.argv[1]}`) {
        console.error("The published manual PDF asset is missing or does not match its tagged manifest.");
        process.exit(1);
      }
    ' "$expected_pdf"
    echo "$tag is already published."
  fi
  exit 0
fi
if [ "$(cat "$lookup_error")" != "release not found" ]; then
  echo "Cannot verify the existing manual release; GitHub lookup failed." >&2
  exit 1
fi
# A tag can exist even when no release exists for it.
check_existing_tag
if [ -z "$remote_tag" ]; then
  # Verify the introduction of an unpublished edition even when this push
  # did not change it. Every intervening first-parent revision must carry the
  # same deck, and the previous edition must be lower.
  before=${MANUAL_PUSH_BEFORE:-}
  if ! [[ "$before" =~ ^[[:xdigit:]]{40}$ ]] || [[ "$before" =~ ^0{40}$ ]]; then
    echo "Cannot verify the unpublished manual edition without the revision before this push." >&2
    exit 1
  fi
  git merge-base --is-ancestor "$before" HEAD
  node -e '
    const {execFileSync} = require("node:child_process");
    const current = require("./docs/manual/manifest.json");
    try {
      const before = JSON.parse(execFileSync("git", ["show", `${process.argv[1]}:docs/manual/manifest.json`], {encoding:"utf8", stdio:["ignore","pipe","ignore"]}));
      if (typeof before.edition !== "number" || typeof before.deck !== "string") throw new Error("invalid push base");
      // Different intermediate decks in the same push were never published.
      if (before.edition < current.edition) process.exit(0);
      const history = execFileSync("git", ["rev-list", "--first-parent", "HEAD"], {encoding:"utf8"}).trim().split("\n");
      for (const ref of history) {
        const previous = JSON.parse(execFileSync("git", ["show", `${ref}:docs/manual/manifest.json`], {encoding:"utf8", stdio:["ignore","pipe","ignore"]}));
        if (typeof previous.edition !== "number" || typeof previous.deck !== "string") break;
        if (previous.edition < current.edition) process.exit(0);
        if (previous.edition !== current.edition || previous.deck !== current.deck) break;
      }
    } catch {}
    console.error("Cannot verify the unpublished manual edition after a prior push; recover it or generate a new edition.");
    process.exit(1);
  ' "$before"
fi
if [ "${1:-}" = "--check" ]; then exit 0; fi
write_notes "$GITHUB_SHA"
gh release create "$tag" docs/manual/lantern-manual.pdf --target "$GITHUB_SHA" --title "QA manual, edition $edition" --notes-file "$notes_file" --latest
