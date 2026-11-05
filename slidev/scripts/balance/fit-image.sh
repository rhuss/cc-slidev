#!/usr/bin/env bash
# fit-image.sh: fit an image to the aspect ratio of an empty slide area.
#
# Usage: fit-image.sh --in <file> --aspect <w:h> [--out <file>]
#
# With ImageMagick 7 (`magick`) the image is center-cropped to the largest
# region of the target aspect and written to --out (default: --in, replaced).
# Prints `FITTED magick`.
# Without `magick` the image is left untouched (copied to --out when --out
# differs from --in) and the script prints `FITTED css`; the caller then sets
# `object-fit: cover` with explicit width and height on the slide.
#
# Exit codes: 0 fitted, 1 missing input or crop failure, 2 usage error.
set -euo pipefail

usage() {
  echo "usage: fit-image.sh --in <file> --aspect <w:h> [--out <file>]" >&2
  exit 2
}

in_file=""
aspect=""
out_file=""

while [ $# -gt 0 ]; do
  case "$1" in
    --in) [ $# -ge 2 ] || usage; in_file="$2"; shift 2 ;;
    --aspect) [ $# -ge 2 ] || usage; aspect="$2"; shift 2 ;;
    --out) [ $# -ge 2 ] || usage; out_file="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "unknown argument: $1" >&2; usage ;;
  esac
done

[ -n "$in_file" ] || usage
[ -n "$aspect" ] || usage
if ! [[ "$aspect" =~ ^[0-9]+(\.[0-9]+)?:[0-9]+(\.[0-9]+)?$ ]]; then
  echo "invalid --aspect '$aspect' (expected w:h, e.g. 16:9)" >&2
  exit 2
fi
aspect_w="${aspect%%:*}"
aspect_h="${aspect##*:}"
if awk -v a="$aspect_w" -v b="$aspect_h" 'BEGIN { exit !(a <= 0 || b <= 0) }'; then
  echo "invalid --aspect '$aspect' (both sides must be > 0)" >&2
  exit 2
fi
[ -n "$out_file" ] || out_file="$in_file"

if [ ! -f "$in_file" ]; then
  echo "input image not found: $in_file" >&2
  exit 1
fi

out_dir="$(dirname "$out_file")"
mkdir -p "$out_dir"

if ! command -v magick >/dev/null 2>&1; then
  if [ "$out_file" != "$in_file" ]; then
    cp "$in_file" "$out_file"
  fi
  echo "FITTED css"
  exit 0
fi

if ! size="$(magick identify -format '%w %h' "${in_file}[0]" 2>/dev/null)"; then
  echo "cannot read image size: $in_file" >&2
  exit 1
fi
img_w="${size%% *}"
img_h="${size##* }"

# Largest crop of the target aspect that fits inside the image.
crop="$(awk -v w="$img_w" -v h="$img_h" -v a="$aspect_w" -v b="$aspect_h" 'BEGIN {
  if (w / h > a / b) { ch = h; cw = int(h * a / b + 0.5) } else { cw = w; ch = int(w * b / a + 0.5) }
  if (cw > w) cw = w; if (ch > h) ch = h
  if (cw < 1) cw = 1; if (ch < 1) ch = 1
  printf "%dx%d", cw, ch
}')"

tmp_out="${out_dir}/.fit-image-$$-$(basename "$out_file")"
cleanup() { rm -f "$tmp_out"; }
trap cleanup EXIT

if ! magick "$in_file" -gravity center -crop "${crop}+0+0" +repage "$tmp_out" >&2; then
  echo "magick crop failed for $in_file" >&2
  exit 1
fi
mv -f "$tmp_out" "$out_file"
echo "FITTED magick"
