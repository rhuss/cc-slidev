#!/usr/bin/env bash
# render.test.sh: render integration test for /slidev:balance (opt-in, RUN_RENDER_TESTS=1).
#
# Renders tests/balance/fixtures/synthetic-deck and checks:
#   - each slide's flags equal expected.json, matched by slide title (SC-009, US1 AS3, AS7)
#   - the hidden slide is recorded with hidden: true
#   - two renders give equal metrics.json once png paths are removed (SC-003)
#   - a preview leaves every fixture slide file unchanged (FR-017, US2 AS2)
#   - the fixture package.json and package-lock.json are unchanged (SC-007)
#   - server stop leaves no owned dev server process alive
#
# Then renders the frozen cc-review talk in tests/balance/fixtures/cc-review and checks:
#   - slide 2 and every slide in expected.json "sparse" carries sparse, and every
#     slide in expected.json "overflow" carries overflow (SC-001)
#   - the set of overflow-flagged slides equals expected.json "overflow" (SC-001)
#   - two renders give equal metrics (SC-003)
#   - the contact sheet and a side-by-side composite are written as PNG (FR-034, FR-016)
#   - round 1 including server start is timed; a WARNING is printed above 120 s (SC-004)
#   - the fixture package.json and package-lock.json are unchanged (SC-007)
#
# Exits non-zero when any assertion fails.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DECK="$SCRIPT_DIR/fixtures/synthetic-deck"
RS="$REPO_ROOT/slidev/scripts/balance/render-slides.sh"
EXPECTED="$DECK/expected.json"
CCR_DECK="$SCRIPT_DIR/fixtures/cc-review"
CCR_EXPECTED="$CCR_DECK/expected.json"
SC004_LIMIT=120

FAILURES=0
TMP="$(mktemp -d "${TMPDIR:-/tmp}/balance-render-test.XXXXXX")"

pass() { echo "ok   $*"; }
fail() {
  echo "FAIL $*" >&2
  FAILURES=$((FAILURES + 1))
}

checksum() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$@"; else sha256sum "$@"; fi
}

# Checksums of every fixture file except installed and generated content.
fixture_checksums() {
  (cd "$DECK" && find . \( -name node_modules -o -name exports \) -prune -o -type f \
      ! -name .balance-preview.md -print | LC_ALL=C sort | while IFS= read -r f; do checksum "$f"; done)
}

stopped=false
ccr_stopped=true
cleanup() {
  if [ "$stopped" = "false" ]; then
    bash "$RS" server stop --deck "$DECK" >/dev/null 2>&1 || true
  fi
  if [ "$ccr_stopped" = "false" ]; then
    bash "$RS" server stop --deck "$CCR_DECK" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT

now() { date +%s; }

echo "== render test: $DECK"

# --- setup -----------------------------------------------------------------
if [ ! -d "$DECK/node_modules" ]; then
  echo "installing fixture dependencies (npm ci)"
  (cd "$DECK" && npm ci --no-audit --no-fund) >&2
fi

pkg_before="$(checksum "$DECK/package.json" "$DECK/package-lock.json")"
files_before="$(fixture_checksums)"

bash "$RS" ensure --deck "$DECK"

t0="$(now)"
bash "$RS" server start --deck "$DECK"
t1="$(now)"

registry="$DECK/exports/balance/server.json"

# --- round 1 render ----------------------------------------------------------
RUN_A="$TMP/run-a"
bash "$RS" render --deck "$DECK" --run "$RUN_A" --round 1 | tee "$TMP/render-a.out"
t2="$(now)"
echo "TIMING server start $((t1 - t0))s, round 1 render $((t2 - t1))s, total $((t2 - t0))s"

METRICS_A="$RUN_A/round-1/metrics.json"
if [ ! -f "$METRICS_A" ]; then
  fail "no metrics.json written at $METRICS_A"
else
  total_expected="$(jq 'length' "$EXPECTED")"
  total_measured="$(jq 'length' "$METRICS_A")"
  if [ "$total_expected" = "$total_measured" ]; then
    pass "metrics.json has $total_measured entries"
  else
    fail "metrics.json has $total_measured entries, expected.json lists $total_expected slides"
  fi

  while IFS= read -r title; do
    want="$(jq -c --arg t "$title" '.[$t]' "$EXPECTED")"
    entry="$(jq -c --arg t "$title" '[.[] | select(.title == $t)]' "$METRICS_A")"
    count="$(jq 'length' <<<"$entry")"
    if [ "$count" != "1" ]; then
      fail "slide \"$title\": found $count metrics entries with this title"
      continue
    fi
    if [ "$want" = '"hidden"' ]; then
      if [ "$(jq '.[0].hidden' <<<"$entry")" = "true" ] && [ "$(jq '.[0].png' <<<"$entry")" = "null" ]; then
        pass "slide \"$title\": hidden: true, not rendered"
      else
        fail "slide \"$title\": expected hidden: true and no png, got $(jq -c '.[0] | {hidden, png}' <<<"$entry")"
      fi
      continue
    fi
    got="$(jq -c '.[0].flags | sort' <<<"$entry")"
    want_sorted="$(jq -c 'sort' <<<"$want")"
    err="$(jq -r '.[0].render_error // empty' <<<"$entry")"
    if [ -n "$err" ]; then
      fail "slide \"$title\": render_error: $err"
    elif [ "$got" = "$want_sorted" ]; then
      pass "slide \"$title\": flags $got"
    else
      fail "slide \"$title\": flags $got, expected $want_sorted ($(jq -c '.[0] | {fill_ratio, vertical_spread, min_body_pt, min_label_pt, columns, overflow}' <<<"$entry"))"
    fi
    png="$(jq -r '.[0].png // empty' <<<"$entry")"
    if [ -z "$png" ] || [ ! -s "$RUN_A/$png" ]; then
      fail "slide \"$title\": png missing ($png)"
    fi
  done < <(jq -r 'keys_unsorted[]' "$EXPECTED")
fi

# --- determinism (SC-003) -----------------------------------------------------
RUN_B="$TMP/run-b"
bash "$RS" render --deck "$DECK" --run "$RUN_B" --round 1 >"$TMP/render-b.out"
if [ -f "$RUN_B/round-1/metrics.json" ] && [ -f "$METRICS_A" ] \
  && diff <(jq -S 'map(del(.png))' "$METRICS_A") <(jq -S 'map(del(.png))' "$RUN_B/round-1/metrics.json") >"$TMP/determinism.diff"; then
  pass "second render gives identical metrics (png paths removed)"
else
  fail "metrics differ between two renders:"
  cat "$TMP/determinism.diff" >&2 || true
fi

# --- round 0 baseline (FR-033: before image of slides changed at pass start) ---
if bash "$RS" render --deck "$DECK" --run "$RUN_B" --round 0 --slides 2 >"$TMP/render-b0.out" \
  && [ "$(jq -r '.[0].png' "$RUN_B/round-0/metrics.json")" = "round-0/slide-02.png" ] \
  && [ -s "$RUN_B/round-0/slide-02.png" ] \
  && diff <(jq -S 'map(del(.png))' "$RUN_B/round-0/metrics.json") \
    <(jq -S 'map(select(.start_no == 2) | del(.png))' "$RUN_B/round-1/metrics.json") >/dev/null; then
  pass "round 0 renders a baseline with the same metrics as round 1"
else
  fail "round 0 baseline render failed or differs from round 1 ($(cat "$TMP/render-b0.out" 2>/dev/null))"
fi

# --- preview leaves slide files untouched (FR-017) ---------------------------
cat >"$TMP/candidate.md" <<'EOF'
---
layout: default
zoom: 1.2
---

# sparse

- One idea
- Another idea
EOF
preview_out="$TMP/preview.out"
if bash "$RS" preview --deck "$DECK" --run "$RUN_A" --name slide-02-zoom --slide-file "$TMP/candidate.md" \
    >"$preview_out" 2>"$TMP/preview.err"; then
  json="$(awk '/^[{[]/ { line = $0 } END { print line }' "$preview_out")"
  if [ -n "$json" ] && [ "$(jq -r '.png' <<<"$json")" = "previews/slide-02-zoom.png" ] \
    && [ -s "$RUN_A/previews/slide-02-zoom.png" ] && [ "$(jq -r '.title' <<<"$json")" = "sparse" ]; then
    pass "preview rendered previews/slide-02-zoom.png (fill $(jq -r '.fill_ratio' <<<"$json"))"
  else
    fail "preview output unexpected: $(cat "$preview_out")"
  fi
else
  fail "preview failed: $(tail -n 20 "$TMP/preview.err")"
fi

# A split candidate on the running preview server (hot reload of .balance-preview.md):
# one PNG and one JSON line per resulting slide.
cat >"$TMP/split.md" <<'EOF'
---
layout: default
---

# part one

- First half of the content

---

# part two

- Second half of the content
EOF
if bash "$RS" preview --deck "$DECK" --run "$RUN_A" --name slide-03-split --slide-file "$TMP/split.md" --split \
    >"$TMP/split.out" 2>"$TMP/split.err"; then
  titles="$(awk '/^[{[]/' "$TMP/split.out" | jq -sc 'map([.title, .png])')"
  want='[["part one","previews/slide-03-split-1.png"],["part two","previews/slide-03-split-2.png"]]'
  if [ "$titles" = "$want" ] && [ -s "$RUN_A/previews/slide-03-split-1.png" ] && [ -s "$RUN_A/previews/slide-03-split-2.png" ]; then
    pass "split preview rendered two slides"
  else
    fail "split preview output unexpected: $titles"
  fi
else
  fail "split preview failed: $(tail -n 20 "$TMP/split.err")"
fi
if [ "$(awk '$0 == ".balance-preview.md"' "$DECK/.gitignore" | wc -l | tr -d ' ')" = "1" ]; then
  pass ".balance-preview.md listed once in the fixture .gitignore"
else
  fail ".balance-preview.md must appear exactly once in $DECK/.gitignore"
fi
files_after="$(fixture_checksums)"
if [ "$files_before" = "$files_after" ]; then
  pass "fixture slide files unchanged after preview"
else
  fail "fixture files changed:"
  diff <(echo "$files_before") <(echo "$files_after") >&2 || true
fi

# --- dependency manifests untouched (SC-007) ---------------------------------
pkg_after="$(checksum "$DECK/package.json" "$DECK/package-lock.json")"
if [ "$pkg_before" = "$pkg_after" ]; then
  pass "package.json and package-lock.json unchanged"
else
  fail "package.json or package-lock.json changed"
fi

# --- server stop --------------------------------------------------------------
owned_pids="$(jq -r '[.main, .preview] | map(select(. != null and .owned == true) | .pid) | .[]' "$registry" 2>/dev/null || true)"
bash "$RS" server stop --deck "$DECK"
stopped=true
for pid in $owned_pids; do
  if kill -0 "$pid" 2>/dev/null || pgrep -g "$pid" >/dev/null 2>&1; then
    fail "owned server pid $pid (or its process group) still alive after server stop"
  else
    pass "owned server pid $pid stopped"
  fi
done
if [ -e "$DECK/.balance-preview.md" ]; then
  fail ".balance-preview.md left behind"
else
  pass ".balance-preview.md removed"
fi

# --- frozen cc-review talk (SC-001, SC-004, SC-007) ---------------------------
echo "== render test: $CCR_DECK"

if [ ! -d "$CCR_DECK/node_modules" ]; then
  echo "installing cc-review fixture dependencies (npm ci)"
  (cd "$CCR_DECK" && npm ci --no-audit --no-fund) >&2
fi

ccr_pkg_before="$(checksum "$CCR_DECK/package.json" "$CCR_DECK/package-lock.json")"

# Drop registry entries left by earlier runs: server stop keeps entries for servers
# it did not start, and server start reuses a registered server without checking
# its title, which could render another deck instead of this fixture.
bash "$RS" server stop --deck "$CCR_DECK" >/dev/null 2>&1 || true
rm -f "$CCR_DECK/exports/balance/server.json"

ccr_stopped=false
c0="$(now)"
bash "$RS" server start --deck "$CCR_DECK"
c1="$(now)"
RUN_C="$TMP/run-ccr"
bash "$RS" render --deck "$CCR_DECK" --run "$RUN_C" --round 1 | tee "$TMP/render-ccr.out"
c2="$(now)"
ccr_total=$((c2 - c0))
echo "TIMING cc-review server start $((c1 - c0))s, round 1 render $((c2 - c1))s, total ${ccr_total}s"
if [ "$ccr_total" -gt "$SC004_LIMIT" ]; then
  echo "WARNING: round 1 took ${ccr_total}s (> $SC004_LIMIT s, SC-004)"
fi

if jq -e '.main.owned == true' "$CCR_DECK/exports/balance/server.json" >/dev/null 2>&1; then
  pass "cc-review rendered on a server started from the fixture"
else
  fail "cc-review server not owned (reused another server): $(jq -c '.main' "$CCR_DECK/exports/balance/server.json" 2>/dev/null)"
fi

METRICS_C="$RUN_C/round-1/metrics.json"
if [ ! -f "$METRICS_C" ]; then
  fail "no metrics.json written at $METRICS_C"
else
  # check_flag <flag> <start_no>: the slide's metrics entry carries the flag.
  check_flag() {
    local flag="$1" n="$2" entry
    entry="$(jq -c --argjson n "$n" '[.[] | select(.start_no == $n)]' "$METRICS_C")"
    if [ "$(jq 'length' <<<"$entry")" != "1" ]; then
      fail "cc-review slide $n: found $(jq 'length' <<<"$entry") metrics entries"
    elif jq -e --arg f "$flag" '.[0].flags | index($f) != null' <<<"$entry" >/dev/null; then
      pass "cc-review slide $n: carries $flag"
    else
      fail "cc-review slide $n: expected $flag, got $(jq -c '.[0] | {title, flags, fill_ratio, vertical_spread, overflow}' <<<"$entry")"
    fi
  }
  for n in $(jq -r '(.sparse // []) + [2] | unique | .[]' "$CCR_EXPECTED"); do
    check_flag sparse "$n"
  done
  for n in $(jq -r '.overflow // [] | .[]' "$CCR_EXPECTED"); do
    check_flag overflow "$n"
  done
  # SC-001 "every slide with content past the canvas edge": the overflow set is exactly the
  # expected one, so a new false positive or a missed overflow fails too.
  got_overflow="$(jq -c '[.[] | select((.flags // []) | index("overflow")) | .start_no] | sort' "$METRICS_C")"
  want_overflow="$(jq -c '.overflow // [] | sort' "$CCR_EXPECTED")"
  if [ "$got_overflow" = "$want_overflow" ]; then
    pass "cc-review overflow set $got_overflow equals expected.json"
  else
    fail "cc-review overflow set $got_overflow, expected $want_overflow"
  fi

  # Determinism on the real talk (SC-003): images, Excalidraw SVGs, imports and web fonts.
  RUN_C2="$TMP/run-ccr-b"
  bash "$RS" render --deck "$CCR_DECK" --run "$RUN_C2" --round 1 >"$TMP/render-ccr-b.out"
  if [ -f "$RUN_C2/round-1/metrics.json" ] \
    && diff <(jq -S 'map(del(.png))' "$METRICS_C") <(jq -S 'map(del(.png))' "$RUN_C2/round-1/metrics.json") >"$TMP/determinism-ccr.diff"; then
    pass "cc-review: second render gives identical metrics (png paths removed)"
  else
    fail "cc-review metrics differ between two renders:"
    cat "$TMP/determinism-ccr.diff" >&2 || true
  fi

  # Contact sheet (FR-034, US5 AS1) and side-by-side composite (FR-016).
  is_png() { [ -s "$1" ] && [ "$(head -c 8 "$1" | od -An -tx1 | tr -d ' \n')" = "89504e470d0a1a0a" ]; }
  if bash "$RS" contact-sheet --deck "$CCR_DECK" --run "$RUN_C" --round 1 >"$TMP/contact.out" 2>&1 \
    && is_png "$RUN_C/contact-sheet.png"; then
    pass "cc-review contact sheet written as PNG"
  else
    fail "cc-review contact sheet missing or not a PNG: $(tail -n 3 "$TMP/contact.out")"
  fi
  CACHE="$(bash "$RS" ensure --deck "$CCR_DECK" | sed -n 's/^RENDER_READY //p')"
  if node "$REPO_ROOT/slidev/scripts/balance/side-by-side.mjs" --cache "$CACHE" \
      --left "$RUN_C/round-1/slide-02.png" --right "$RUN_C/round-1/slide-03.png" \
      --out "$TMP/compare.png" >"$TMP/compare.out" 2>&1 && is_png "$TMP/compare.png"; then
    pass "side-by-side composite written as PNG"
  else
    fail "side-by-side composite failed: $(tail -n 3 "$TMP/compare.out")"
  fi
fi

ccr_owned_pids="$(jq -r '[.main, .preview] | map(select(. != null and .owned == true) | .pid) | .[]' \
  "$CCR_DECK/exports/balance/server.json" 2>/dev/null || true)"
bash "$RS" server stop --deck "$CCR_DECK"
ccr_stopped=true
for pid in $ccr_owned_pids; do
  if kill -0 "$pid" 2>/dev/null || pgrep -g "$pid" >/dev/null 2>&1; then
    fail "cc-review owned server pid $pid (or its process group) still alive after server stop"
  else
    pass "cc-review owned server pid $pid stopped"
  fi
done

ccr_pkg_after="$(checksum "$CCR_DECK/package.json" "$CCR_DECK/package-lock.json")"
if [ "$ccr_pkg_before" = "$ccr_pkg_after" ]; then
  pass "cc-review package.json and package-lock.json unchanged"
else
  fail "cc-review package.json or package-lock.json changed"
fi

if [ "$FAILURES" -gt 0 ]; then
  echo "== render test: $FAILURES assertion(s) failed" >&2
  exit 1
fi
echo "== render test: all assertions passed"
