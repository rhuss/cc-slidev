// palette.mjs: color math for deck box styles (WCAG contrast, tint compositing,
// label shade search, hue checks, red/green detection, palette presets and validation).
//
// Hue rule for near-gray colors: a color whose HSL saturation is below NEUTRAL_SATURATION
// is "hue-neutral" (its hue is not perceived as a color). Hue-neutral roles (typically
// `context`, a slate or gray) are skipped by the distinct-hue check and by the red/green
// check. Saturated roles must differ pairwise by at least MIN_HUE_DISTANCE degrees, and at
// most one role may be hue-neutral (two grays cannot be told apart by hue).

export const ROLES = Object.freeze(['main', 'risk', 'context', 'takeaway']);
export const MIN_CONTRAST = 4.5;
export const TINT_ALPHA = 0.1;
export const BORDER_ALPHA = 0.3;
export const NEUTRAL_SATURATION = 0.2;
export const MIN_HUE_DISTANCE = 30;
export const DEFAULT_LIGHT_BG = '#ffffff';
export const DEFAULT_DARK_BG = '#121212';

export const PRESETS = Object.freeze({
  default: Object.freeze({ main: '#3b82f6', risk: '#f97316', context: '#64748b', takeaway: '#8b5cf6' }),
  'okabe-ito': Object.freeze({ main: '#0072B2', risk: '#D55E00', context: '#6B7280', takeaway: '#CC79A7' }),
});

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(value) {
  return typeof value === 'string' && HEX_RE.test(value.trim());
}

/** '#rgb' or '#rrggbb' to {r, g, b} with 0-255 channels. Throws on invalid input. */
export function hexToRgb(hex) {
  const m = typeof hex === 'string' ? hex.trim().match(HEX_RE) : null;
  if (!m) throw new Error(`invalid hex color: ${hex}`);
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG 2.x relative luminance (0..1). */
export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colors (1..21). */
export function contrast(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Composite fgHex at the given alpha over an opaque bgHex; returns the resulting hex. */
export function composite(fgHex, alpha, bgHex) {
  const f = hexToRgb(fgHex);
  const b = hexToRgb(bgHex);
  const mix = (x, y) => x * alpha + y * (1 - alpha);
  return rgbToHex({ r: mix(f.r, b.r), g: mix(f.g, b.g), b: mix(f.b, b.b) });
}

/** HSL of a hex color: h in degrees (0..360), s and l in 0..1. */
export function rgbToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

export function hslToHex({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb;
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = l - c / 2;
  return rgbToHex({ r: (rgb[0] + m) * 255, g: (rgb[1] + m) * 255, b: (rgb[2] + m) * 255 });
}

/** Hue in degrees (0..360). */
export function hue(hex) {
  return rgbToHsl(hex).h;
}

/** HSL lightness in percent (0..100). */
export function lightness(hex) {
  return rgbToHsl(hex).l * 100;
}

/** HSL saturation (0..1). */
export function saturation(hex) {
  return rgbToHsl(hex).s;
}

/** True when the color is so unsaturated that its hue does not read as a color. */
export function isHueNeutral(hex) {
  return saturation(hex) < NEUTRAL_SATURATION;
}

/** Circular distance between two hues (degrees or hex colors), 0..180. */
export function hueDistance(a, b) {
  const ha = typeof a === 'number' ? a : hue(a);
  const hb = typeof b === 'number' ? b : hue(b);
  const d = Math.abs((((ha - hb) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
}

/**
 * Find a label color for a role: keep hue and saturation, step HSL lightness
 * (darken for the `light` scheme, lighten for `dark`) one point at a time until the
 * contrast against tintBg reaches MIN_CONTRAST. Throws if no lightness passes.
 */
export function labelShade(hex, tintBg, scheme = 'light') {
  if (scheme !== 'light' && scheme !== 'dark') throw new Error(`unknown scheme: ${scheme}`);
  const { h, s, l } = rgbToHsl(hex);
  const step = scheme === 'light' ? -0.01 : 0.01;
  let cur = l;
  for (;;) {
    const candidate = hslToHex({ h, s, l: cur });
    if (contrast(candidate, tintBg) >= MIN_CONTRAST) return candidate;
    if ((scheme === 'light' && cur <= 0) || (scheme === 'dark' && cur >= 1)) break;
    cur = Math.max(0, Math.min(1, cur + step));
  }
  throw new Error(
    `no ${scheme} label shade of ${hex} reaches ${MIN_CONTRAST}:1 against ${tintBg}`,
  );
}

// Reds wrap around 0 degrees: crimson and rose (340-360) are as red as 0-20 (FR-024).
const inRed = (h) => (h >= 0 && h <= 20) || (h >= 340 && h <= 360);
// Greens include yellow-green and lime (Tailwind lime-500 is about 84 degrees).
const inGreen = (h) => h >= 75 && h <= 170;

/**
 * Detect a red/green pair: two roles, one with hue in 0-20 or 340-360 degrees and one in 75-170
 * degrees, whatever their lightness (FR-024 allows no red/green pair at all). Hue-neutral roles
 * are ignored. Returns [roleA, roleB] for the first pair found, or null.
 */
export function redGreenPair(roles) {
  const entries = Object.entries(roles || {}).filter(([, v]) => isHex(v) && !isHueNeutral(v));
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [na, ca] = entries[i];
      const [nb, cb] = entries[j];
      const ha = hue(ca);
      const hb = hue(cb);
      const pair = (inRed(ha) && inGreen(hb)) || (inGreen(ha) && inRed(hb));
      if (pair) return [na, nb];
    }
  }
  return null;
}

/**
 * Validate a palette. Returns a list of error strings (empty when valid).
 * Checks: the four roles exist and are hex colors, no unknown roles, at most one hue-neutral
 * role, saturated roles have distinct hues, no red/green pair, and every role yields a label
 * shade with at least 4.5:1 contrast against its 10% tint in light and dark.
 */
export function validatePalette(roles, { lightBg = DEFAULT_LIGHT_BG, darkBg = DEFAULT_DARK_BG } = {}) {
  const errors = [];
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) {
    return ['roles must be a mapping of main, risk, context, takeaway to hex colors'];
  }
  for (const r of ROLES) {
    if (roles[r] === undefined || roles[r] === null || roles[r] === '') errors.push(`missing role: ${r}`);
    else if (!isHex(roles[r])) errors.push(`role ${r}: invalid hex color ${roles[r]}`);
  }
  for (const k of Object.keys(roles)) {
    if (!ROLES.includes(k)) errors.push(`unknown role: ${k} (allowed: ${ROLES.join(', ')})`);
  }
  for (const [name, bg] of [['lightBg', lightBg], ['darkBg', darkBg]]) {
    if (!isHex(bg)) errors.push(`${name}: invalid hex color ${bg}`);
  }
  if (errors.length) return errors;

  const valid = ROLES.map((r) => [r, roles[r]]);
  const neutral = valid.filter(([, c]) => isHueNeutral(c)).map(([r]) => r);
  if (neutral.length > 1) {
    errors.push(`hues not distinct: ${neutral.join(', ')} are all near-gray; at most one role may be hue-neutral`);
  }
  const saturated = valid.filter(([, c]) => !isHueNeutral(c));
  for (let i = 0; i < saturated.length; i++) {
    for (let j = i + 1; j < saturated.length; j++) {
      const d = hueDistance(saturated[i][1], saturated[j][1]);
      if (d < MIN_HUE_DISTANCE) {
        errors.push(
          `hues not distinct: ${saturated[i][0]} and ${saturated[j][0]} differ by ${Math.round(d)} degrees (minimum ${MIN_HUE_DISTANCE})`,
        );
      }
    }
  }
  const rg = redGreenPair(Object.fromEntries(valid));
  if (rg) errors.push(`red/green pair: ${rg[0]} and ${rg[1]}`);

  for (const [r, c] of valid) {
    for (const [scheme, bg] of [['light', lightBg], ['dark', darkBg]]) {
      try {
        labelShade(c, composite(c, TINT_ALPHA, bg), scheme);
      } catch {
        errors.push(`role ${r}: no ${scheme} label shade reaches ${MIN_CONTRAST}:1 against its tint on ${bg}`);
      }
    }
  }
  return errors;
}
