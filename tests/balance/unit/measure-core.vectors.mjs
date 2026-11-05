// Shared test vectors for the measure-core helpers.
//
// Used by measure-core.test.mjs against slidev/scripts/balance/measure-core.mjs
// and reusable for the inline copies inside the in-page measure.js. Each vector
// is {name, args, expected}; call fn(...args) and compare deepEqual.

// A typical content area on a 980x552 canvas (theme padding removed).
// 868 and 472 are multiples of the 4px grid.
const CONTENT = { x: 56, y: 40, w: 868, h: 472 };

export const clipRectVectors = [
  {
    name: 'rect inside the area is unchanged',
    args: [{ x: 10, y: 10, w: 20, h: 20 }, { x: 0, y: 0, w: 100, h: 100 }],
    expected: { x: 10, y: 10, w: 20, h: 20 },
  },
  {
    name: 'rect crossing the top-left corner is clipped',
    args: [{ x: -20, y: -10, w: 60, h: 30 }, { x: 0, y: 0, w: 100, h: 100 }],
    expected: { x: 0, y: 0, w: 40, h: 20 },
  },
  {
    name: 'rect crossing the bottom-right corner is clipped',
    args: [{ x: 80, y: 90, w: 40, h: 40 }, { x: 0, y: 0, w: 100, h: 100 }],
    expected: { x: 80, y: 90, w: 20, h: 10 },
  },
  {
    name: 'rect fully outside returns null',
    args: [{ x: 200, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 100, h: 100 }],
    expected: null,
  },
  {
    name: 'rect touching the edge only returns null',
    args: [{ x: 100, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 100, h: 100 }],
    expected: null,
  },
];

export const unionAreaVectors = [
  {
    name: 'overlapping rectangles count the overlap once',
    args: [[{ x: 0, y: 0, w: 40, h: 40 }, { x: 20, y: 20, w: 40, h: 40 }], { x: 0, y: 0, w: 100, h: 100 }, 4],
    expected: 2800,
  },
  {
    name: 'disjoint rectangles add up',
    args: [[{ x: 0, y: 0, w: 40, h: 40 }, { x: 60, y: 60, w: 20, h: 20 }], { x: 0, y: 0, w: 100, h: 100 }, 4],
    expected: 2000,
  },
  {
    name: 'nested rectangle adds nothing',
    args: [[{ x: 0, y: 0, w: 40, h: 40 }, { x: 8, y: 8, w: 8, h: 8 }], { x: 0, y: 0, w: 100, h: 100 }, 4],
    expected: 1600,
  },
  {
    name: 'rect past the top-left corner is clipped to the area',
    args: [[{ x: -20, y: -20, w: 60, h: 60 }], { x: 0, y: 0, w: 100, h: 100 }, 4],
    expected: 1600,
  },
  {
    name: 'rect past the bottom-right corner is clipped to the area',
    args: [[{ x: 80, y: 80, w: 40, h: 40 }], { x: 0, y: 0, w: 100, h: 100 }, 4],
    expected: 400,
  },
  {
    name: 'rect fully outside the area counts zero',
    args: [[{ x: 300, y: 300, w: 40, h: 40 }], { x: 0, y: 0, w: 100, h: 100 }, 4],
    expected: 0,
  },
  {
    name: 'no rects gives zero',
    args: [[], { x: 0, y: 0, w: 100, h: 100 }, 4],
    expected: 0,
  },
  {
    name: 'area with an offset origin',
    args: [[{ x: 56, y: 40, w: 868, h: 140 }], CONTENT, 4],
    expected: 868 * 140,
  },
  {
    name: 'partial edge cells contribute their true size',
    args: [[{ x: 0, y: 0, w: 10, h: 10 }], { x: 0, y: 0, w: 10, h: 10 }, 4],
    expected: 100,
  },
  {
    name: 'off-grid rect is counted by cell centers',
    args: [[{ x: 0, y: 0, w: 10, h: 10 }], { x: 0, y: 0, w: 12, h: 12 }, 4],
    expected: 64,
  },
  {
    name: 'default grid is 4px',
    args: [[{ x: 0, y: 0, w: 40, h: 40 }, { x: 20, y: 20, w: 40, h: 40 }], { x: 0, y: 0, w: 100, h: 100 }],
    expected: 2800,
  },
];

export const largestEmptyRectVectors = [
  {
    name: 'top-third slide leaves the bottom band empty',
    args: [
      [
        { x: 56, y: 40, w: 600, h: 140 }, // title and first lines
        { x: 56, y: 180, w: 400, h: 40 }, // short last bullet
      ],
      CONTENT,
      4,
    ],
    expected: { x: 56, y: 220, w: 868, h: 292 },
  },
  {
    name: 'empty right column on a two-column slide',
    args: [
      [
        { x: 56, y: 40, w: 420, h: 100 },
        { x: 56, y: 160, w: 420, h: 300 },
      ],
      CONTENT,
      4,
    ],
    expected: { x: 476, y: 40, w: 448, h: 472 },
  },
  {
    name: 'no content returns the whole area',
    args: [[], CONTENT, 4],
    expected: { x: 56, y: 40, w: 868, h: 472 },
  },
  {
    name: 'fully covered area returns null',
    args: [[{ x: 0, y: 0, w: 980, h: 552 }], CONTENT, 4],
    expected: null,
  },
  {
    name: 'equal candidates keep the topmost one',
    args: [[{ x: 0, y: 40, w: 100, h: 20 }], { x: 0, y: 0, w: 100, h: 100 }, 4],
    expected: { x: 0, y: 0, w: 100, h: 40 },
  },
];

export const pxToPtVectors = [
  { name: '18.375px on a 980px canvas is 18pt', args: [18.375, 980], expected: 18 },
  { name: '980px on a 980px canvas is 960pt', args: [980, 980], expected: 960 },
  { name: '20px on a 1280px canvas is 15pt', args: [20, 1280], expected: 15 },
  { name: 'default canvas width is 980', args: [49], expected: 48 },
];

export const unscaleVectors = [
  {
    name: 'container rendered at 2x (1960px for a 980px canvas)',
    args: [{ x: 100, y: 50, w: 200, h: 80 }, 1960 / 980],
    expected: { x: 50, y: 25, w: 100, h: 40 },
  },
  {
    name: 'container rendered at half size',
    args: [{ x: 100, y: 50, w: 200, h: 80 }, 490 / 980],
    expected: { x: 200, y: 100, w: 400, h: 160 },
  },
  {
    name: 'scale 1 returns an equal copy',
    args: [{ x: 1, y: 2, w: 3, h: 4 }, 1],
    expected: { x: 1, y: 2, w: 3, h: 4 },
  },
];

export const allVectors = {
  clipRect: clipRectVectors,
  unionArea: unionAreaVectors,
  largestEmptyRect: largestEmptyRectVectors,
  pxToPt: pxToPtVectors,
  unscale: unscaleVectors,
};
