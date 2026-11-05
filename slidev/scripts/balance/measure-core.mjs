// Pure geometry and unit helpers for the balance pass.
//
// Every function here is self-contained: no imports, no DOM, no calls to the
// other exports. The in-page measure.js keeps inline copies of these
// functions (page.evaluate cannot import modules), and both copies are
// checked against the same vectors in tests/balance/unit/measure-core.vectors.mjs.
//
// Rects are {x, y, w, h} in canvas px. Grid functions rasterise the area into
// cells of `grid` px starting at the area origin; the last row and column may
// be narrower when the area size is not a multiple of the grid. A cell counts
// as covered when its center lies inside a rect, which makes results exact for
// grid-aligned input and stable for everything else.

/**
 * Intersection of `rect` with `area`, or null when they do not overlap.
 */
export function clipRect(rect, area) {
  const x1 = Math.max(rect.x, area.x);
  const y1 = Math.max(rect.y, area.y);
  const x2 = Math.min(rect.x + rect.w, area.x + area.w);
  const y2 = Math.min(rect.y + rect.h, area.y + area.h);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * Area (px^2) of the union of `rects`, clipped to `area`, on a `grid` px grid.
 */
export function unionArea(rects, area, grid = 4) {
  if (!area || area.w <= 0 || area.h <= 0) return 0;
  const cols = Math.ceil(area.w / grid);
  const rows = Math.ceil(area.h / grid);
  const cellW = (c) => Math.min(grid, area.w - c * grid);
  const cellH = (r) => Math.min(grid, area.h - r * grid);
  const covered = new Uint8Array(cols * rows);
  for (const rect of rects || []) {
    if (!rect || !(rect.w > 0) || !(rect.h > 0)) continue;
    const rx2 = rect.x + rect.w;
    const ry2 = rect.y + rect.h;
    for (let r = 0; r < rows; r++) {
      const cy = area.y + r * grid + cellH(r) / 2;
      if (cy < rect.y || cy >= ry2) continue;
      for (let c = 0; c < cols; c++) {
        const cx = area.x + c * grid + cellW(c) / 2;
        if (cx >= rect.x && cx < rx2) covered[r * cols + c] = 1;
      }
    }
  }
  let total = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (covered[r * cols + c]) total += cellW(c) * cellH(r);
    }
  }
  return total;
}

/**
 * Largest axis-aligned rectangle inside `area` that no rect covers, on a
 * `grid` px grid. Returns {x, y, w, h} in canvas px, or null when the area is
 * fully covered. Ties keep the first rectangle found scanning rows top to
 * bottom, then columns left to right.
 */
export function largestEmptyRect(rects, area, grid = 4) {
  if (!area || area.w <= 0 || area.h <= 0) return null;
  const cols = Math.ceil(area.w / grid);
  const rows = Math.ceil(area.h / grid);
  const cellW = (c) => Math.min(grid, area.w - c * grid);
  const cellH = (r) => Math.min(grid, area.h - r * grid);
  const covered = new Uint8Array(cols * rows);
  for (const rect of rects || []) {
    if (!rect || !(rect.w > 0) || !(rect.h > 0)) continue;
    const rx2 = rect.x + rect.w;
    const ry2 = rect.y + rect.h;
    for (let r = 0; r < rows; r++) {
      const cy = area.y + r * grid + cellH(r) / 2;
      if (cy < rect.y || cy >= ry2) continue;
      for (let c = 0; c < cols; c++) {
        const cx = area.x + c * grid + cellW(c) / 2;
        if (cx >= rect.x && cx < rx2) covered[r * cols + c] = 1;
      }
    }
  }
  // Prefix offsets so partial edge cells contribute their true size.
  const xOff = new Array(cols + 1).fill(0);
  for (let c = 0; c < cols; c++) xOff[c + 1] = xOff[c] + cellW(c);
  const yOff = new Array(rows + 1).fill(0);
  for (let r = 0; r < rows; r++) yOff[r + 1] = yOff[r] + cellH(r);

  // Maximal rectangle via histogram heights per row (stack method).
  const heights = new Array(cols).fill(0);
  let best = null;
  let bestArea = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      heights[c] = covered[r * cols + c] ? 0 : heights[c] + 1;
    }
    const stack = [];
    for (let c = 0; c <= cols; c++) {
      const h = c === cols ? 0 : heights[c];
      let start = c;
      while (stack.length && stack[stack.length - 1].h >= h) {
        const top = stack.pop();
        if (top.h > 0) {
          const w = xOff[c] - xOff[top.start];
          const top0 = r - top.h + 1;
          const hh = yOff[r + 1] - yOff[top0];
          const a = w * hh;
          const cand = { x: area.x + xOff[top.start], y: area.y + yOff[top0], w, h: hh };
          if (
            a > bestArea ||
            (a === bestArea && best && (cand.y < best.y || (cand.y === best.y && cand.x < best.x)))
          ) {
            bestArea = a;
            best = cand;
          }
        }
        start = top.start;
      }
      stack.push({ start, h });
    }
  }
  return best;
}

/**
 * CSS px at native canvas scale to pt relative to a 16:9 slide where the
 * canvas width equals 960pt (980px canvas: 18.375px = 18pt).
 */
export function pxToPt(px, canvasWidth = 980) {
  return (px * 960) / canvasWidth;
}

/**
 * Undo the slide container's CSS scale (rendered width / canvas width).
 */
export function unscale(rect, scale) {
  if (!scale || scale === 1) return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  return { x: rect.x / scale, y: rect.y / scale, w: rect.w / scale, h: rect.h / scale };
}
