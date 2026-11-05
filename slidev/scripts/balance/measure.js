// measure.js: in-page measurement of one rendered Slidev slide for /slidev:balance.
//
// `measureSlide(no, opts)` is passed to Playwright's `page.evaluate`, which
// serialises the function source and runs it in the page. It therefore must be
// fully self-contained: no imports and no references to anything outside its
// own body. The geometry helpers below are inline copies of measure-core.mjs
// (page.evaluate cannot import modules). tests/balance/unit/measure-inline.test.mjs
// runs these copies against the measure-core test vectors and checks that their
// source matches measure-core.mjs, so the two copies cannot drift apart.
//
// Call `measureSlide(0, { helpersOnly: true })` outside a page to get the
// inline helpers ({clipRect, unionArea, largestEmptyRect, pxToPt, unscale}).
//
// opts:
//   canvasWidth   deck canvas width in px (default 980)
//   canvasHeight  deck canvas height in px (default ceil(canvasWidth * 9 / 16))
//   grid          grid size in px for the union and the largest empty rectangle (default 4)
//   layout        fallback layout name when the page does not expose one
//
// Returns the measured part of a SlideMetrics entry (data-model.md), in canvas px
// and pt, rounded to fixed precision so two renders compare equal (FR-005):
//   {title, layout, balance, fill_ratio, vertical_spread, overflow: {any, elements},
//    min_body_pt, min_label_pt, words, elements, columns, gap}

export function measureSlide(no, opts) {
  opts = opts || {};

  // ---------------------------------------------------------------------------
  // Inline copies of measure-core.mjs (keep identical; checked by a unit test)
  // ---------------------------------------------------------------------------

  function clipRect(rect, area) {
    const x1 = Math.max(rect.x, area.x);
    const y1 = Math.max(rect.y, area.y);
    const x2 = Math.min(rect.x + rect.w, area.x + area.w);
    const y2 = Math.min(rect.y + rect.h, area.y + area.h);
    if (x2 <= x1 || y2 <= y1) return null;
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  function unionArea(rects, area, grid = 4) {
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

  function largestEmptyRect(rects, area, grid = 4) {
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

  function pxToPt(px, canvasWidth = 980) {
    return (px * 960) / canvasWidth;
  }

  function unscale(rect, scale) {
    if (!scale || scale === 1) return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    return { x: rect.x / scale, y: rect.y / scale, w: rect.w / scale, h: rect.h / scale };
  }

  if (opts.helpersOnly) return { clipRect, unionArea, largestEmptyRect, pxToPt, unscale };

  // ---------------------------------------------------------------------------
  // Measurement
  // ---------------------------------------------------------------------------

  const canvasW = opts.canvasWidth || 980;
  const canvasH = opts.canvasHeight || Math.ceil((canvasW * 9) / 16);
  const grid = opts.grid || 4;

  const r2 = (n) => Math.round(n * 100) / 100;
  const r4 = (n) => Math.round(n * 10000) / 10000;
  const roundRect = (r) => (r ? { x: r2(r.x), y: r2(r.y), w: r2(r.w), h: r2(r.h) } : null);

  const slideEl = document.querySelector(`[data-slidev-no="${no}"]`);
  if (!slideEl) throw new Error(`slide container [data-slidev-no="${no}"] not found`);
  const slideRect = slideEl.getBoundingClientRect();
  // Container scale: rendered width / canvas width.
  const scale = slideRect.width / canvasW || 1;

  const toCanvas = (domRect) =>
    unscale({ x: domRect.left - slideRect.left, y: domRect.top - slideRect.top, w: domRect.width, h: domRect.height }, scale);

  // Scale of an element relative to the canvas (zoom frontmatter, CSS transforms),
  // snapped to 2 decimals so layout rounding never changes a result.
  const localScale = (el) => {
    const w = el.offsetWidth;
    if (!w) return 1;
    const s = el.getBoundingClientRect().width / w / scale;
    return s > 0 ? Math.round(s * 100) / 100 : 1;
  };

  const isVisible = (el) => {
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // Frontmatter of the rendered slide (dev server only).
  let frontmatter = {};
  let metaTitle = null;
  let metaLayout = null;
  try {
    const slides = (window.__slidev__ && window.__slidev__.nav && window.__slidev__.nav.slides) || [];
    const route = slides.find((s) => s && s.no === no) || slides[no - 1];
    const meta = route && route.meta;
    if (meta && meta.slide) {
      frontmatter = meta.slide.frontmatter || {};
      metaTitle = meta.slide.title || null;
    }
    if (meta && typeof meta.layout === 'string') metaLayout = meta.layout;
  } catch (e) {
    frontmatter = {};
  }
  const layout = String(frontmatter.layout || metaLayout || opts.layout || (no === 1 ? 'cover' : 'default'));
  const balance = frontmatter.balance == null ? null : String(frontmatter.balance);

  const root = slideEl.querySelector('.slidev-layout') || slideEl;
  const rootRect = toCanvas(root.getBoundingClientRect());
  const rootStyle = getComputedStyle(root);
  const rootScale = localScale(root);
  const pad = (v) => (parseFloat(v) || 0) * rootScale;
  const area = {
    x: rootRect.x + pad(rootStyle.paddingLeft),
    y: rootRect.y + pad(rootStyle.paddingTop),
    w: Math.max(0, rootRect.w - pad(rootStyle.paddingLeft) - pad(rootStyle.paddingRight)),
    h: Math.max(0, rootRect.h - pad(rootStyle.paddingTop) - pad(rootStyle.paddingBottom)),
  };

  // Shadow roots (Slidev renders Mermaid inside an open shadow root on the host).
  const shadowHosts = [...root.querySelectorAll('*')].filter((el) => el.shadowRoot);
  const outermostSvgs = (scope) =>
    [...scope.querySelectorAll('svg')].filter((svg) => !(svg.parentElement && svg.parentElement.closest('svg')));

  // Content elements: visible leaf blocks, plus the diagrams inside shadow roots.
  // Their element boxes are used for the overflow check (a block past the canvas
  // edge overflows even when its text does not).
  const CONTENT_SELECTOR =
    'p, li, h1, h2, h3, h4, h5, h6, pre, table, img, svg, blockquote, video, iframe, canvas, .bx, .katex-display';
  const contentEls = [...root.querySelectorAll(CONTENT_SELECTOR)].filter(
    (el) => !(el.tagName.toLowerCase() === 'svg' && el.parentElement && el.parentElement.closest('svg')),
  );
  for (const host of shadowHosts) contentEls.push(...outermostSvgs(host.shadowRoot));
  const blockBoxes = [];
  for (const el of contentEls) {
    if (!isVisible(el)) continue;
    blockBoxes.push({ el, rect: toCanvas(el.getBoundingClientRect()) });
  }

  // Visible content (FR-007): what the eye sees as occupied, as rectangles.
  // A text block (p, li, h1-h6, blockquote, or text in any other element)
  // spans the full content width even when its text is short, so its element
  // box would count empty space as content. The rule:
  //   1. Filled boxes count with their whole border box: pre, table (cells,
  //      borders and stripes read as one block), img, svg and diagram hosts,
  //      video, iframe, canvas, .bx, .katex-display, plus any non-inline element
  //      with a visible background (non-transparent background-color or a
  //      background-image) or a visible border (width > 0, style not none or
  //      hidden, colour not transparent), e.g. a themed blockquote or a card div.
  //   2. Text counts as its rendered line boxes: for every visible text node,
  //      the rects of Range.getClientRects() (one per line fragment), widened
  //      vertically to the computed line height so the lines of a paragraph
  //      tile without stripes. Text inside a filled box adds nothing new.
  //   3. A list item's marker counts as the marker gutter (the parent list's
  //      left padding) beside the item's first line box.
  // The union of these rectangles drives fill, vertical spread and the gap.
  const FILLED_SELECTOR = 'pre, table, img, svg, video, iframe, canvas, .bx, .katex-display';
  const alphaOf = (color) => {
    if (!color || color === 'transparent') return 0;
    const slash = color.match(/\/\s*([\d.]+)(%?)\s*\)$/);
    if (slash) return parseFloat(slash[1]) / (slash[2] ? 100 : 1);
    const rgba = color.match(/^rgba\(([^)]*)\)$/);
    if (rgba) {
      const parts = rgba[1].split(',');
      return parts.length === 4 ? parseFloat(parts[3]) : 1;
    }
    return 1;
  };
  const isFilled = (el) => {
    if (el.matches(FILLED_SELECTOR)) return true;
    const cs = getComputedStyle(el);
    if (cs.display === 'inline' || cs.display === 'contents') return false;
    if (alphaOf(cs.backgroundColor) > 0 || (cs.backgroundImage && cs.backgroundImage !== 'none')) return true;
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const style = cs['border' + side + 'Style'];
      if (
        (parseFloat(cs['border' + side + 'Width']) || 0) > 0 &&
        style !== 'none' &&
        style !== 'hidden' &&
        alphaOf(cs['border' + side + 'Color']) > 0
      ) {
        return true;
      }
    }
    return false;
  };
  const content = [];
  for (const el of root.querySelectorAll('*')) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    if (el.tagName.toLowerCase() === 'svg' && el.parentElement && el.parentElement.closest('svg')) continue;
    if (el.closest('style, script, template, noscript')) continue;
    if (!isVisible(el) || !isFilled(el)) continue;
    content.push({ el, rect: toCanvas(el.getBoundingClientRect()) });
  }
  for (const host of shadowHosts) {
    for (const svg of outermostSvgs(host.shadowRoot)) {
      if (isVisible(svg)) content.push({ el: svg, rect: toCanvas(svg.getBoundingClientRect()) });
    }
  }
  const lineHeightOf = (el) => {
    const cs = getComputedStyle(el);
    const lh = cs.lineHeight;
    let px = null;
    if (/px$/.test(lh)) px = parseFloat(lh);
    else if (/^[\d.]+$/.test(lh)) px = parseFloat(lh) * (parseFloat(cs.fontSize) || 0);
    return px > 0 ? px * localScale(el) : null;
  };
  const firstLine = new Map();
  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = textWalker.nextNode(); node; node = textWalker.nextNode()) {
    if (!node.nodeValue || !/\S/.test(node.nodeValue)) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest('style, script, template, noscript, svg')) continue;
    if (!isVisible(parent)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const lh = lineHeightOf(parent);
    for (const dr of range.getClientRects()) {
      if (!(dr.width > 0) || !(dr.height > 0)) continue;
      const r = toCanvas(dr);
      if (lh !== null && lh > r.h) {
        r.y -= (lh - r.h) / 2;
        r.h = lh;
      }
      content.push({ el: parent, rect: r });
      const li = parent.closest('li');
      if (li && root.contains(li) && !firstLine.has(li)) firstLine.set(li, r);
    }
  }
  for (const [li, line] of firstLine) {
    const cs = getComputedStyle(li);
    if (cs.display !== 'list-item' || cs.listStyleType === 'none' || cs.listStylePosition !== 'outside') continue;
    const list = li.parentElement;
    const gutter = list ? (parseFloat(getComputedStyle(list).paddingLeft) || 0) * localScale(list) : 0;
    const liLeft = toCanvas(li.getBoundingClientRect()).x;
    if (gutter > 0) content.push({ el: li, rect: { x: liLeft - gutter, y: line.y, w: gutter, h: line.h } });
  }
  const contentRects = content.map((c) => c.rect);
  const clipped = contentRects.map((r) => clipRect(r, area)).filter(Boolean);

  // Fill ratio and vertical spread.
  const areaSize = area.w * area.h;
  const fill = areaSize > 0 ? unionArea(clipped, area, grid) / areaSize : 0;
  let lowest = 0;
  for (const r of contentRects) lowest = Math.max(lowest, r.y + r.h);
  const spread = Math.min(1, Math.max(0, lowest / canvasH));

  // Overflow: clipped scroll content, or content past the canvas edge by more than 1px.
  // Diagram renderers (Mermaid, Excalidraw) give their <svg> a random id on every render, so
  // ids of svg elements are left out: the description must be equal across renders (FR-005).
  const describe = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id && s !== 'svg') s += '#' + CSS.escape(el.id);
    for (const c of [...el.classList].slice(0, 2)) s += '.' + CSS.escape(c);
    return s;
  };
  const overflowEls = [];
  for (const el of [slideEl, ...slideEl.querySelectorAll('*')]) {
    if (!isVisible(el)) continue;
    const cs = getComputedStyle(el);
    const clipsY = cs.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 1;
    const clipsX = cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1;
    if (clipsY || clipsX) overflowEls.push(el);
  }
  for (const { el, rect } of [...blockBoxes, ...content]) {
    if (rect.x < -1 || rect.y < -1 || rect.x + rect.w > canvasW + 1 || rect.y + rect.h > canvasH + 1) {
      overflowEls.push(el);
    }
  }
  const overflowSelectors = [];
  for (const el of overflowEls) {
    const d = describe(el);
    if (!overflowSelectors.includes(d)) overflowSelectors.push(d);
  }

  // Smallest body text (p, li, td, th, blockquote, .bx-body; no headings, code, footers).
  const BODY_BLOCKS = 'p, li, td, th, blockquote, .bx-body';
  const BODY_EXCLUDE = 'h1, h2, h3, h4, h5, h6, pre, code, footer, .slidev-page-number, svg, style, script';
  let minBody = null;
  let words = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue;
    if (!text || !/\S/.test(text)) continue;
    const parent = node.parentElement;
    if (!parent || !isVisible(parent)) continue;
    if (parent.closest('style, script, template, noscript, svg')) continue;
    if (!parent.closest('h1, h2, h3, h4, h5, h6, pre')) {
      words += text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    }
    if (parent.closest(BODY_EXCLUDE)) continue;
    const block = parent.closest(BODY_BLOCKS);
    if (!block || !root.contains(block)) continue;
    const px = (parseFloat(getComputedStyle(parent).fontSize) || 0) * localScale(parent);
    if (px > 0 && (minBody === null || px < minBody)) minBody = px;
  }

  // Smallest diagram label: <text>/<tspan> and <foreignObject> content of inline
  // SVGs, computed font-size times the SVG's current transform scale.
  const ctmScale = (el) => {
    const m = el.getScreenCTM && el.getScreenCTM();
    return m ? Math.hypot(m.a, m.b) / scale : 1;
  };
  const diagramSvgs = [];
  for (const svg of outermostSvgs(root)) diagramSvgs.push({ svg, host: null });
  for (const host of shadowHosts) for (const svg of outermostSvgs(host.shadowRoot)) diagramSvgs.push({ svg, host });
  let minLabel = null;
  let labelledSvgs = 0;
  const hostsWithDiagram = new Set();
  for (const { svg, host } of diagramSvgs) {
    let labels = 0;
    for (const t of svg.querySelectorAll('text, tspan')) {
      const own = [...t.childNodes].some((n) => n.nodeType === 3 && /\S/.test(n.nodeValue));
      if (!own || !isVisible(t)) continue;
      const px = (parseFloat(getComputedStyle(t).fontSize) || 0) * ctmScale(t);
      if (px > 0) {
        labels++;
        if (minLabel === null || px < minLabel) minLabel = px;
      }
    }
    for (const fo of svg.querySelectorAll('foreignObject')) {
      const s = ctmScale(fo);
      const fw = document.createTreeWalker(fo, NodeFilter.SHOW_TEXT);
      for (let n = fw.nextNode(); n; n = fw.nextNode()) {
        if (!/\S/.test(n.nodeValue || '')) continue;
        const p = n.parentElement;
        if (!p || !isVisible(p)) continue;
        const px = (parseFloat(getComputedStyle(p).fontSize) || 0) * s;
        if (px > 0) {
          labels++;
          if (minLabel === null || px < minLabel) minLabel = px;
        }
      }
    }
    if (labels > 0) {
      labelledSvgs += host ? 0 : 1;
      if (host) hostsWithDiagram.add(host);
    } else if (host) {
      hostsWithDiagram.add(host);
    }
  }
  const IMG_DIAGRAM = /diagram|excalidraw|mermaid|plantuml|\.svg(\?|#|$)/i;
  const visibleImgs = [...root.querySelectorAll('img')].filter(isVisible);
  const imgDiagrams = visibleImgs.filter((img) => IMG_DIAGRAM.test(img.getAttribute('src') || ''));
  let minLabelPt = null;
  if (minLabel !== null) minLabelPt = r2(pxToPt(minLabel, canvasW));
  else if (imgDiagrams.length > 0) minLabelPt = 'unmeasured';

  // Elements: bullets + images + diagrams + code blocks; a box without bullets counts once.
  const bullets = [...root.querySelectorAll('li')].filter(isVisible).length;
  const codeBlocks = [...root.querySelectorAll('pre')].filter(isVisible).length;
  const emptyBoxes = [...root.querySelectorAll('.bx')].filter((b) => isVisible(b) && !b.querySelector('li')).length;
  const elements = bullets + visibleImgs.length + hostsWithDiagram.size + labelledSvgs + codeBlocks + emptyBoxes;

  // Columns for two-column layouts: content extent per column, shorter / taller.
  let columns = null;
  let emptyColumn = null;
  if (layout === 'two-cols' || layout === 'two-cols-header') {
    const left = root.querySelector('.col-left');
    const right = root.querySelector('.col-right');
    if (left && right) {
      const extent = (col) => {
        let top = Infinity;
        let bottom = -Infinity;
        for (const { el, rect } of content) {
          if (!col.contains(el) && !(el.getRootNode().host && col.contains(el.getRootNode().host))) continue;
          top = Math.min(top, rect.y);
          bottom = Math.max(bottom, rect.y + rect.h);
        }
        return bottom > top ? bottom - top : 0;
      };
      const lh = extent(left);
      const rh = extent(right);
      const taller = Math.max(lh, rh);
      columns = { left_px: r2(lh), right_px: r2(rh), ratio: taller > 0 ? r4(Math.min(lh, rh) / taller) : null };
      if (taller > 0 && (lh === 0 || rh === 0)) {
        emptyColumn = clipRect(toCanvas((lh === 0 ? left : right).getBoundingClientRect()), area);
      }
    }
  }

  const gap = emptyColumn || largestEmptyRect(clipped, area, grid);

  let title = null;
  const heading = root.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading && heading.textContent.trim()) title = heading.textContent.trim().replace(/\s+/g, ' ');
  else if (metaTitle) title = String(metaTitle);

  return {
    title,
    layout,
    balance,
    fill_ratio: r4(fill),
    vertical_spread: r4(spread),
    overflow: { any: overflowSelectors.length > 0, elements: overflowSelectors },
    min_body_pt: minBody === null ? null : r2(pxToPt(minBody, canvasW)),
    min_label_pt: minLabelPt,
    words,
    elements,
    columns,
    gap: roundRect(gap),
  };
}
