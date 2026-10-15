import { writeFileSync } from 'node:fs';
const sha = process.env.RELEASE_SHA;
if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('RELEASE_SHA must be a full commit SHA.');
writeFileSync('release.json', JSON.stringify({ sha }));
