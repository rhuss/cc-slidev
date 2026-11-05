#!/usr/bin/env bash
# generate-image.sh: generate one image for a sparse slide through a chosen route.
#
# Usage:
#   generate-image.sh --route <codex|gemini-cli|openai-api|gemini-api> [--model <m>]
#                     --prompt-file <f> --aspect <w:h> --out <file>
#   generate-image.sh --route <r> --check
#
# Routes:
#   codex       `codex exec`; falls back to the newest file in
#               ${CODEX_HOME:-$HOME/.codex}/generated_images/ created during the run.
#   gemini-cli  `gemini -y -p "/generate ..."` with the nanobanana extension;
#               takes the newest file in ./nanobanana-output/ of a temp dir.
#               --model is passed as NANOBANANA_MODEL.
#   openai-api  POST /v1/images/generations (OPENAI_API_KEY), default model gpt-image-1.
#   gemini-api  POST :generateContent (GEMINI_API_KEY), default model gemini-2.5-flash-image.
#
# Output (stdout, one line):
#   exit 0  IMAGE <file>          (or AVAILABLE <route> with --check)
#   exit 1  FAILED <reason>       generation failed at runtime
#   exit 2  usage error (message on stderr)
#   exit 3  UNAVAILABLE <reason>  route cannot be used here
#
# API keys are read from the environment and only ever sent to curl through
# stdin as header lines. They are never placed on a command line or printed.
set -euo pipefail

usage() {
  echo "usage: generate-image.sh --route <codex|gemini-cli|openai-api|gemini-api> [--model <m>] --prompt-file <f> --aspect <w:h> --out <file>" >&2
  echo "       generate-image.sh --route <r> --check" >&2
  exit 2
}

route=""
model=""
prompt_file=""
aspect=""
out_file=""
check_only=0

while [ $# -gt 0 ]; do
  case "$1" in
    --route) [ $# -ge 2 ] || usage; route="$2"; shift 2 ;;
    --model) [ $# -ge 2 ] || usage; model="$2"; shift 2 ;;
    --prompt-file) [ $# -ge 2 ] || usage; prompt_file="$2"; shift 2 ;;
    --aspect) [ $# -ge 2 ] || usage; aspect="$2"; shift 2 ;;
    --out) [ $# -ge 2 ] || usage; out_file="$2"; shift 2 ;;
    --check) check_only=1; shift ;;
    -h|--help) usage ;;
    *) echo "unknown argument: $1" >&2; usage ;;
  esac
done

case "$route" in
  codex|gemini-cli|openai-api|gemini-api) ;;
  "") echo "missing --route" >&2; usage ;;
  *) echo "unknown route: $route" >&2; usage ;;
esac

if [ "$check_only" -eq 0 ]; then
  [ -n "$prompt_file" ] || { echo "missing --prompt-file" >&2; usage; }
  [ -n "$aspect" ] || { echo "missing --aspect" >&2; usage; }
  [ -n "$out_file" ] || { echo "missing --out" >&2; usage; }
  if ! [[ "$aspect" =~ ^[0-9]+(\.[0-9]+)?:[0-9]+(\.[0-9]+)?$ ]]; then
    echo "invalid --aspect '$aspect' (expected w:h, e.g. 16:9)" >&2
    exit 2
  fi
  if awk -v a="${aspect%%:*}" -v b="${aspect##*:}" 'BEGIN { exit !(a <= 0 || b <= 0) }'; then
    echo "invalid --aspect '$aspect' (both sides must be > 0)" >&2
    exit 2
  fi
fi

unavailable() { echo "UNAVAILABLE $*"; exit 3; }
failed() { echo "FAILED $*"; exit 1; }

# Removes any API key value from a message and keeps it on one short line.
sanitize() {
  local msg="$1"
  if [ -n "${OPENAI_API_KEY:-}" ]; then msg="${msg//"$OPENAI_API_KEY"/***}"; fi
  if [ -n "${GEMINI_API_KEY:-}" ]; then msg="${msg//"$GEMINI_API_KEY"/***}"; fi
  printf '%s' "$msg" | tr '\r\n\t' '   ' | cut -c1-300
}

require_tools() {
  local t
  for t in "$@"; do
    command -v "$t" >/dev/null 2>&1 || unavailable "$t not found on PATH (needed by route $route)"
  done
}

# ---- availability check -------------------------------------------------
case "$route" in
  codex)
    command -v codex >/dev/null 2>&1 || unavailable "codex CLI not found on PATH"
    ;;
  gemini-cli)
    command -v gemini >/dev/null 2>&1 || unavailable "gemini CLI not found on PATH"
    ext_list="$(gemini extensions list 2>&1 || true)"
    [[ "$ext_list" == *nanobanana* ]] || unavailable "gemini CLI extension nanobanana is not installed (gemini extensions install https://github.com/gemini-cli-extensions/nanobanana)"
    ;;
  openai-api)
    [ -n "${OPENAI_API_KEY:-}" ] || unavailable "OPENAI_API_KEY is not set"
    require_tools curl jq base64
    ;;
  gemini-api)
    [ -n "${GEMINI_API_KEY:-}" ] || unavailable "GEMINI_API_KEY is not set"
    require_tools curl jq base64
    ;;
esac

if [ "$check_only" -eq 1 ]; then
  echo "AVAILABLE $route"
  exit 0
fi

# ---- prepare --------------------------------------------------------------
[ -f "$prompt_file" ] || failed "prompt file not found: $prompt_file"
prompt="$(cat "$prompt_file")"
[ -n "${prompt//[[:space:]]/}" ] || failed "prompt file is empty: $prompt_file"

shopt -s nocasematch
if ! [[ "$prompt" == *"aspect ratio"* ]]; then
  prompt="$prompt Aspect ratio $aspect. No text in the image."
fi
shopt -u nocasematch

out_dir="$(dirname "$out_file")"
mkdir -p "$out_dir"
out_abs="$(cd "$out_dir" && pwd)/$(basename "$out_file")"

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/generate-image.XXXXXX")"
cleanup() { rm -rf "$work_dir"; }
trap cleanup EXIT

# Newest regular file in $1 that is newer than marker file $2 (empty if none).
newest_since() {
  local dir="$1" marker="$2" newest="" f
  [ -d "$dir" ] || return 0
  while IFS= read -r f; do
    if [ -z "$newest" ] || [ "$f" -nt "$newest" ]; then newest="$f"; fi
  done < <(find "$dir" -type f -newer "$marker" 2>/dev/null)
  printf '%s' "$newest"
}

last_log_line() {
  local line
  line="$(awk 'NF { l = $0 } END { print l }' "$1" 2>/dev/null || true)"
  sanitize "$line"
}

# Ratio helpers (awk): closest candidate by log distance to the target ratio.
closest_ratio() {
  # $1 = target w:h, remaining args = candidates "w:h"
  local target="$1"; shift
  printf '%s\n' "$@" | awk -F: -v t="$target" '
    BEGIN { split(t, p, ":"); tr = log(p[1] / p[2]); best = ""; bd = 0 }
    { d = log($1 / $2) - tr; if (d < 0) d = -d; if (best == "" || d < bd) { best = $0; bd = d } }
    END { print best }'
}

decode_b64_to_out() {
  # stdin: base64 data; writes $out_abs
  if ! base64 --decode > "$work_dir/image.bin" 2>/dev/null; then
    failed "could not decode image data from the API response"
  fi
  [ -s "$work_dir/image.bin" ] || failed "API returned empty image data"
  mv -f "$work_dir/image.bin" "$out_abs"
}

api_error_message() {
  # $1 = response file; prints the API error message if there is one
  jq -r 'if type == "object" and has("error") then (.error.message // (.error | tostring)) else empty end' "$1" 2>/dev/null || true
}

# ---- generate ---------------------------------------------------------------
case "$route" in
  codex)
    marker="$work_dir/start"
    touch "$marker"
    sleep 1 2>/dev/null || true
    codex_args=(exec --skip-git-repo-check)
    if [ -n "$model" ]; then codex_args+=(-m "$model"); fi
    set +e
    codex "${codex_args[@]}" "$prompt Save the image as $out_abs" > "$work_dir/codex.log" 2>&1 < /dev/null
    rc=$?
    set -e
    if [ ! -s "$out_abs" ]; then
      found="$(newest_since "${CODEX_HOME:-$HOME/.codex}/generated_images" "$marker")"
      if [ -n "$found" ]; then
        cp "$found" "$out_abs"
      elif [ "$rc" -ne 0 ]; then
        failed "codex exited with status $rc: $(last_log_line "$work_dir/codex.log")"
      else
        failed "codex finished but no image was written to $out_abs or ${CODEX_HOME:-$HOME/.codex}/generated_images/"
      fi
    fi
    ;;

  gemini-cli)
    marker="$work_dir/start"
    touch "$marker"
    sleep 1 2>/dev/null || true
    set +e
    if [ -n "$model" ]; then
      (cd "$work_dir" && NANOBANANA_MODEL="$model" gemini -y -p "/generate $prompt") > "$work_dir/gemini.log" 2>&1 < /dev/null
    else
      (cd "$work_dir" && gemini -y -p "/generate $prompt") > "$work_dir/gemini.log" 2>&1 < /dev/null
    fi
    rc=$?
    set -e
    found="$(newest_since "$work_dir/nanobanana-output" "$marker")"
    if [ -n "$found" ]; then
      cp "$found" "$out_abs"
    elif [ "$rc" -ne 0 ]; then
      failed "gemini exited with status $rc: $(last_log_line "$work_dir/gemini.log")"
    else
      failed "gemini finished but no image was found in nanobanana-output/"
    fi
    ;;

  openai-api)
    [ -n "$model" ] || model="gpt-image-1"
    ratio="$(closest_ratio "$aspect" 1:1 3:2 2:3)"
    case "$ratio" in
      3:2) size="1536x1024" ;;
      2:3) size="1024x1536" ;;
      *) size="1024x1024" ;;
    esac
    if [[ "$model" == dall-e* ]]; then
      jq -n --arg m "$model" --arg p "$prompt" --arg s "$size" \
        '{model: $m, prompt: $p, size: $s, n: 1, response_format: "b64_json"}' > "$work_dir/body.json"
    else
      jq -n --arg m "$model" --arg p "$prompt" --arg s "$size" \
        '{model: $m, prompt: $p, size: $s, n: 1}' > "$work_dir/body.json"
    fi
    set +e
    http_code="$(printf 'Authorization: Bearer %s\n' "$OPENAI_API_KEY" | curl -sS -X POST \
      "https://api.openai.com/v1/images/generations" \
      -H @- -H "Content-Type: application/json" \
      --data-binary @"$work_dir/body.json" \
      -o "$work_dir/response.json" -w "%{http_code}" 2> "$work_dir/curl.err")"
    rc=$?
    set -e
    if [ "$rc" -ne 0 ]; then
      failed "curl request to OpenAI failed (exit $rc): $(last_log_line "$work_dir/curl.err")"
    fi
    err="$(api_error_message "$work_dir/response.json")"
    [ -z "$err" ] || failed "OpenAI API error: $(sanitize "$err")"
    b64="$(jq -r '.data[0].b64_json // empty' "$work_dir/response.json" 2>/dev/null || true)"
    [ -n "$b64" ] || failed "OpenAI API response contained no image data (HTTP ${http_code:-unknown})"
    printf '%s' "$b64" | decode_b64_to_out
    ;;

  gemini-api)
    [ -n "$model" ] || model="gemini-2.5-flash-image"
    ratio="$(closest_ratio "$aspect" 1:1 2:3 3:2 3:4 4:3 4:5 5:4 9:16 16:9 21:9)"
    jq -n --arg p "$prompt" --arg r "$ratio" \
      '{contents: [{parts: [{text: $p}]}], generationConfig: {responseModalities: ["IMAGE"], imageConfig: {aspectRatio: $r}}}' \
      > "$work_dir/body.json"
    set +e
    http_code="$(printf 'x-goog-api-key: %s\n' "$GEMINI_API_KEY" | curl -sS -X POST \
      "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent" \
      -H @- -H "Content-Type: application/json" \
      --data-binary @"$work_dir/body.json" \
      -o "$work_dir/response.json" -w "%{http_code}" 2> "$work_dir/curl.err")"
    rc=$?
    set -e
    if [ "$rc" -ne 0 ]; then
      failed "curl request to Gemini failed (exit $rc): $(last_log_line "$work_dir/curl.err")"
    fi
    err="$(api_error_message "$work_dir/response.json")"
    [ -z "$err" ] || failed "Gemini API error: $(sanitize "$err")"
    b64="$(jq -r '[.candidates[]?.content.parts[]? | (.inlineData // .inline_data) | select(. != null) | .data][0] // empty' "$work_dir/response.json" 2>/dev/null || true)"
    if [ -z "$b64" ]; then
      reason="$(jq -r '.promptFeedback.blockReason // .candidates[0].finishReason // empty' "$work_dir/response.json" 2>/dev/null || true)"
      failed "Gemini API response contained no image data (HTTP ${http_code:-unknown})${reason:+ (reason: $(sanitize "$reason"))}"
    fi
    printf '%s' "$b64" | decode_b64_to_out
    ;;
esac

[ -s "$out_abs" ] || failed "no image written to $out_file"
echo "IMAGE $out_file"
