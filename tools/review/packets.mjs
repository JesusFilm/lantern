/** Keep each path's complete diff and head context together, in first-seen order. */
export function planPackets({ sections, context, guidanceBytes = 0, maxBytes = 200_000 }) {
  const units = new Map();
  for (const section of sections) {
    if (!units.has(section.path)) units.set(section.path, []);
    units.get(section.path).push(section.text);
  }
  const packets = [];
  const overhead = guidanceBytes + 8000;
  let packet;
  let bytes = overhead;
  for (const [path, texts] of units) {
    const diff = texts.join('');
    const files = context.filter(file => file.path === path);
    const weight = Buffer.byteLength(diff) + files.reduce((sum, file) => sum + Buffer.byteLength(file.text), 0);
    if (overhead + weight > maxBytes) throw new Error(`${path} exceeds the packet byte limit (${maxBytes})`);
    if (!packet || bytes + weight > maxBytes) {
      if (packets.length === 20) throw new Error('Review exceeds the limit of 20 packets');
      packet = { diff: '', files: [], paths: [] };
      packets.push(packet);
      bytes = overhead;
    }
    packet.diff += diff;
    packet.files.push(...files);
    packet.paths.push(path);
    bytes += weight;
  }
  return packets.length ? packets : [{ diff: '', files: [], paths: [] }];
}

/** Run a bounded number of workers while preserving the input result order. */
export async function reviewPool(items, worker, concurrency = 3) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new RangeError('Review concurrency must be a positive integer');
  const results = new Array(items.length);
  let next = 0;
  let failed = false;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }));
  return results;
}
