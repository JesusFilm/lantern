import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { DIFF, world, run, finalCheck, userMessage, modelCalls } from './fake-github.mjs';

const pdf = Buffer.from('%PDF-1.7\nexample\n%%EOF\n');
const hash = data => createHash('sha256').update(data).digest('hex');
const path = 'docs/manual/lantern-manual.pdf';
const section = `diff --git a/${path} b/${path}\nindex 1111111..2222222 100644\nBinary files a/${path} and b/${path} differ\n`;
const manifest = JSON.stringify({ pdf: hash(pdf), screenshots: {} });
const contents = { [`${path}@head`]: pdf, 'docs/manual/manifest.json@head': manifest };

test('a generated PDF is accounted for while source still reaches the model', async () => {
  const manifestDiff = 'diff --git a/docs/manual/manifest.json b/docs/manual/manifest.json\n--- a/docs/manual/manifest.json\n+++ b/docs/manual/manifest.json\n@@ -1 +1 @@\n-old\n+new\n';
  const browserDiff = 'diff --git a/server/guide.browser.test.ts b/server/guide.browser.test.ts\n--- a/server/guide.browser.test.ts\n+++ b/server/guide.browser.test.ts\n@@ -1 +1,2 @@\n test\n+assertion\n';
  const w = world({ diff: DIFF + section + manifestDiff + browserDiff, contents });
  assert.equal((await run(w)).conclusion, 'success');
  assert.match(userMessage(w), /client\/Guide\.tsx/);
  assert.match(userMessage(w), /server\/guide\.browser\.test\.ts/);
  assert.match(userMessage(w), /docs\/manual\/manifest\.json/);
  assert.doesNotMatch(userMessage(w), /Binary files/);
  assert.match(finalCheck(w).output.summary, /lantern-manual\.pdf/);
  assert.match(finalCheck(w).output.summary, /not.*model|model.*not/i);
});

test('missing or inconsistent manifest and non-PDF content fail before model review', async () => {
  for (const value of [null, '{}', JSON.stringify({ pdf: '0'.repeat(64) })]) {
    const w = world({ diff: DIFF + section, contents: { ...contents, 'docs/manual/manifest.json@head': value } });
    assert.equal((await run(w)).conclusion, 'failure');
    assert.equal(modelCalls(w).length, 0);
  }
  const data = Buffer.from('not a PDF');
  const w = world({ diff: DIFF + section, contents: { [`${path}@head`]: data, 'docs/manual/manifest.json@head': JSON.stringify({ pdf: hash(data) }) } });
  assert.equal((await run(w)).conclusion, 'failure');
});

test('PNG additions and modifications require their own head manifest hash', async () => {
  const name = 'guide-start.png';
  const imagePath = `docs/manual/screenshots/${name}`;
  const image = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('fixture')]);
  for (const metadata of ['index 1111111..2222222 100644', 'new file mode 100644\nindex 0000000..2222222']) {
    const change = `diff --git a/${imagePath} b/${imagePath}\n${metadata}\nBinary files a/${imagePath} and b/${imagePath} differ\n`;
    const w = world({ diff: DIFF + change, contents: { [`${imagePath}@head`]: image, 'docs/manual/manifest.json@head': JSON.stringify({ screenshots: { [name]: hash(image) } }) } });
    assert.equal((await run(w)).conclusion, 'success');
    assert.match(finalCheck(w).output.summary, /guide-start\.png/);
  }
});

test('other binaries, unsupported paths, mode changes, renames and deletions fail closed', async () => {
  const changes = [
    section.replaceAll(path, 'docs/manual/supplied/file.png'),
    section.replaceAll(path, 'docs/manual/screenshots/nested/file.png'),
    section.replace('index 1111111..2222222 100644', 'old mode 100644\nnew mode 100755\nindex 1111111..2222222'),
    section.replace('index 1111111..2222222 100644', 'deleted file mode 100644\nindex 1111111..0000000'),
    `diff --git a/other.pdf b/${path}\nsimilarity index 100%\nrename from other.pdf\nrename to ${path}\n`,
  ];
  for (const change of changes) {
    const w = world({ diff: DIFF + change, contents });
    assert.equal((await run(w)).conclusion, 'failure', change);
    assert.equal(modelCalls(w).length, 0);
  }
});
