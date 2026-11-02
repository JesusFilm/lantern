/** Arrange images in rows of equal height so every image fits the box uncropped. */
export interface Placement { index: number; width: number; height: number }
export interface MediaLayout { rows: Placement[][]; area: number }

export function layoutMedia(aspects: number[], box: { width: number; height: number }, gap = 16, caption = 28): MediaLayout {
  if (!aspects.length) return { rows: [], area: 0 };
  let best: MediaLayout = { rows: [], area: -1 };
  for (let count = 1; count <= Math.min(3, aspects.length); count++) {
    const rows = split(aspects, count);
    const rowGapTotal = gap * (rows.length - 1) + caption * rows.length;
    // Height from width for each row, then scale everything down to fit the box height.
    const heights = rows.map((row) => (box.width - gap * (row.length - 1)) / row.reduce((sum, i) => sum + aspects[i]!, 0));
    const scale = Math.min(1, (box.height - rowGapTotal) / heights.reduce((a, b) => a + b, 0));
    const placed = rows.map((row, r) =>
      row.map((index) => ({ index, height: Math.floor(heights[r]! * scale), width: Math.floor(heights[r]! * scale * aspects[index]!) })),
    );
    const area = placed.flat().reduce((sum, p) => sum + p.width * p.height, 0);
    if (area > best.area * 1.15 || best.area < 0) best = { rows: placed, area };
  }
  return best;
}

/** Contiguous rows with balanced total aspect ratio, preserving order. */
function split(aspects: number[], count: number) {
  const total = aspects.reduce((a, b) => a + b, 0);
  const rows: number[][] = [[]];
  let sum = 0;
  aspects.forEach((aspect, index) => {
    const target = (total / count) * rows.length;
    if (rows.length < count && rows.at(-1)!.length && sum + aspect / 2 > target) rows.push([]);
    rows.at(-1)!.push(index);
    sum += aspect;
  });
  return rows;
}

