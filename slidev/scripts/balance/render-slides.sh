#!/usr/bin/env bash
# render-slides.sh: render tooling wrapper for /slidev:balance.
#
# Usage: render-slides.sh <subcommand> [options]
#
# Subcommands:
#   ensure [--check]              install the pinned render tooling into the plugin cache;
#                                 --check installs nothing and prints RENDER_READY <cache>
#                                 or INSTALL_NEEDED <what> (exit 0 either way)
#   server start [--preview]      reuse or start the deck's (or the preview) dev server
#   server stop                   stop the dev servers this script started and forget
#                                 reused ones (their registry entries are cleared)
#   render --run <dir> --round <n> [--slides <range>]
#                                 render and measure slides (start-of-pass numbers),
#                                 print one SLIDE line per slide, write round-<n>/metrics.json
#                                 (round 0: baseline of slides changed before round 1)
#   preview --run <dir> --name <name> --slide-file <md> [--split]
#                                 render a candidate through .balance-preview.md on the
#                                 preview server; stdout: one JSON metrics line per slide
#   contact-sheet --run <dir> --round <n>
#                                 grid of the latest PNG per slide to <run>/contact-sheet.png
#   rhythm --run <dir>            rhythm observations as JSON from the latest metrics
#
# Common options (accepted by every subcommand):
#   --deck <dir>     deck directory (default: current directory)
#   --entry <file>   entry markdown file relative to the deck (default: slides.md)
#
# Exit codes: 0 ok, 1 failure, 2 usage error, 3 render environment unavailable.
# Stdout lines are prefixed with SLIDE, SERVER, RENDER_READY, INSTALL_NEEDED, NOTICE or WARNING.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$SCRIPT_DIR/package.json"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/cc-slidev/render"

EXIT_OK=0
EXIT_FAIL=1
EXIT_USAGE=2
EXIT_UNAVAILABLE=3

# ---------------------------------------------------------------------------
# Shared helpers (reused by all subcommands)
# ---------------------------------------------------------------------------

usage() {
  cat >&2 <<'EOF'
Usage: render-slides.sh <subcommand> [--deck <dir>] [--entry <file>] [options]

Subcommands:
  ensure [--check]           install render tooling into the plugin cache (one-time);
                             --check only reports RENDER_READY or INSTALL_NEEDED
  server start [--preview]   reuse or start the main (or preview) dev server
  server stop                stop owned dev servers, forget reused ones, remove .balance-preview.md
  render --run <dir> --round <n> [--slides <range>]
  preview --run <dir> --name <name> --slide-file <md> [--split]
  contact-sheet --run <dir> --round <n>
  rhythm --run <dir>

Exit codes: 0 ok, 1 failure, 2 usage error, 3 render environment unavailable.
EOF
}

die() {
  # die <exit-code> <message...>
  local code="$1"
  shift
  echo "ERROR: $*" >&2
  exit "$code"
}

die_usage() {
  echo "ERROR: $*" >&2
  usage
  exit "$EXIT_USAGE"
}

# Parse the options shared by all subcommands. Sets DECK_DIR (absolute),
# ENTRY (relative to the deck) and REST_ARGS (everything not consumed).
DECK_DIR=""
ENTRY="slides.md"
REST_ARGS=()
parse_common_args() {
  local deck_arg=""
  REST_ARGS=()
  while [ $# -gt 0 ]; do
    case "$1" in
      --deck)
        [ $# -ge 2 ] || die_usage "--deck needs a directory"
        deck_arg="$2"
        shift 2
        ;;
      --deck=*)
        deck_arg="${1#--deck=}"
        shift
        ;;
      --entry)
        [ $# -ge 2 ] || die_usage "--entry needs a file"
        ENTRY="$2"
        shift 2
        ;;
      --entry=*)
        ENTRY="${1#--entry=}"
        shift
        ;;
      *)
        REST_ARGS+=("$1")
        shift
        ;;
    esac
  done
  [ -n "$deck_arg" ] || deck_arg="$PWD"
  [ -d "$deck_arg" ] || die_usage "deck directory not found: $deck_arg"
  DECK_DIR="$(cd "$deck_arg" && pwd)"
}

# Require that the entry file exists in the deck.
require_entry() {
  [ -f "$DECK_DIR/$ENTRY" ] || die_usage "entry file not found: $DECK_DIR/$ENTRY"
}

# Pinned playwright-core version from the install manifest.
# Plain sed instead of jq, so the setup hint still works when jq is missing.
pinned_playwright_version() {
  sed -n 's/.*"playwright-core"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$MANIFEST" | head -n 1
}

# Shared Playwright browser cache (PLAYWRIGHT_BROWSERS_PATH wins).
browsers_path() {
  if [ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ] && [ "${PLAYWRIGHT_BROWSERS_PATH}" != "0" ]; then
    printf '%s\n' "$PLAYWRIGHT_BROWSERS_PATH"
  elif [ "$(uname -s)" = "Darwin" ]; then
    printf '%s\n' "$HOME/Library/Caches/ms-playwright"
  else
    printf '%s\n' "${XDG_CACHE_HOME:-$HOME/.cache}/ms-playwright"
  fi
}

# Path of the cached playwright-core package.
playwright_core_dir() {
  printf '%s\n' "$CACHE_DIR/node_modules/playwright-core"
}

# Installed playwright-core version in the cache, empty when missing.
installed_playwright_version() {
  local pkg
  pkg="$(playwright_core_dir)/package.json"
  if [ -f "$pkg" ]; then
    jq -r '.version // empty' "$pkg"
  fi
}

# Chromium revision expected by the cached playwright-core (empty when unreadable).
expected_chromium_revision() {
  jq -r '.browsers[] | select(.name == "chromium") | .revision' \
    "$(playwright_core_dir)/browsers.json" 2>/dev/null || true
}

# Directory of the full Chromium build for the expected revision.
chromium_dir() {
  printf '%s/chromium-%s\n' "$(browsers_path)" "$(expected_chromium_revision)"
}

# Playwright writes INSTALLATION_COMPLETE last, so a download cut short is not "present".
chromium_present() {
  [ -f "$(chromium_dir)/INSTALLATION_COMPLETE" ]
}

# Print the manual setup commands for the render environment on stderr.
manual_setup_hint() {
  local version
  version="$(pinned_playwright_version 2>/dev/null || true)"
  cat >&2 <<EOF
Render environment unavailable. Set it up manually with:
  mkdir -p "$CACHE_DIR"
  cp "$MANIFEST" "$CACHE_DIR/package.json"
  (cd "$CACHE_DIR" && npm install --no-audit --no-fund)
  npx --prefix "$CACHE_DIR" playwright-core install chromium
Then run this command again. (playwright-core pin: $version, browsers: $(browsers_path))
EOF
}

unavailable() {
  echo "ERROR: $*" >&2
  manual_setup_hint
  exit "$EXIT_UNAVAILABLE"
}

# ---------------------------------------------------------------------------
# ensure
# ---------------------------------------------------------------------------

cmd_ensure() {
  local check=false
  if [ ${#REST_ARGS[@]} -eq 1 ] && [ "${REST_ARGS[0]}" = "--check" ]; then
    check=true
  elif [ ${#REST_ARGS[@]} -ne 0 ]; then
    die_usage "ensure takes only --check: ${REST_ARGS[*]}"
  fi
  command -v node >/dev/null 2>&1 || unavailable "node not found on PATH"
  command -v npm >/dev/null 2>&1 || unavailable "npm not found on PATH"
  command -v jq >/dev/null 2>&1 || unavailable "jq not found on PATH"

  local pin installed
  pin="$(pinned_playwright_version)"
  [ -n "$pin" ] && [ "$pin" != "null" ] || die "$EXIT_FAIL" "no playwright-core pin in $MANIFEST"
  installed="$(installed_playwright_version)"

  if [ "$check" = "true" ]; then
    # Report only, so the command can tell the presenter before a long first install (FR-006).
    if [ "$installed" != "$pin" ]; then
      echo "INSTALL_NEEDED playwright-core $pin and Chromium (one-time)"
    elif [ -z "$(expected_chromium_revision)" ] || ! chromium_present; then
      echo "INSTALL_NEEDED Chromium (one-time)"
    else
      echo "RENDER_READY $CACHE_DIR"
    fi
    return 0
  fi

  if [ "$installed" != "$pin" ]; then
    echo "NOTICE: installing render tooling (one-time)"
    mkdir -p "$CACHE_DIR" || unavailable "cannot create cache dir $CACHE_DIR"
    cp "$MANIFEST" "$CACHE_DIR/package.json" || unavailable "cannot copy manifest to $CACHE_DIR"
    if ! (cd "$CACHE_DIR" && npm install --no-audit --no-fund) >&2; then
      unavailable "npm install of playwright-core@$pin failed (offline?)"
    fi
    installed="$(installed_playwright_version)"
    [ "$installed" = "$pin" ] || unavailable "playwright-core $pin not found in $CACHE_DIR after install"
  fi

  local rev
  rev="$(expected_chromium_revision)"
  [ -n "$rev" ] || unavailable "cannot read the chromium revision from playwright-core browsers.json"

  if ! chromium_present; then
    echo "NOTICE: installing Chromium revision $rev into $(browsers_path) (one-time)"
    if ! npx --prefix "$CACHE_DIR" playwright-core install chromium >&2; then
      unavailable "Chromium download failed (offline?)"
    fi
    chromium_present || unavailable "Chromium build $(chromium_dir) still missing after install"
  fi

  echo "RENDER_READY $CACHE_DIR"
}

# ---------------------------------------------------------------------------
# Dev server helpers (registry in <deck>/exports/balance/server.json)
# ---------------------------------------------------------------------------

PREVIEW_ENTRY=".balance-preview.md"
DEFAULT_PORT=3030
FIRST_FREE_PORT=3031
LAST_FREE_PORT=3099
SERVER_WAIT_SECONDS=60

balance_dir() {
  printf '%s/exports/balance\n' "$DECK_DIR"
}

registry_file() {
  printf '%s/server.json\n' "$(balance_dir)"
}

# Print the registry JSON (an empty registry when the file is missing or invalid).
registry_read() {
  local file
  file="$(registry_file)"
  if [ -f "$file" ] && jq -e 'type == "object"' "$file" >/dev/null 2>&1; then
    jq -c '{main: (.main // null), preview: (.preview // null)}' "$file"
  else
    printf '%s\n' '{"main":null,"preview":null}'
  fi
}

# registry_get <role>: print the role's entry as JSON or "null".
registry_get() {
  registry_read | jq -c --arg role "$1" '.[$role] // null'
}

# registry_put <role> <entry-json|null>: replace one role's entry.
registry_put() {
  local file tmp
  file="$(registry_file)"
  mkdir -p "$(balance_dir)"
  tmp="$file.tmp.$$"
  registry_read | jq --arg role "$1" --argjson entry "$2" '.[$role] = $entry' >"$tmp"
  mv "$tmp" "$file"
}

pid_alive() {
  [ -n "${1:-}" ] && [ "$1" != "null" ] && kill -0 "$1" 2>/dev/null
}

# True when the pid runs a Slidev server (guards against pid reuse).
pid_is_slidev() {
  pid_alive "$1" || return 1
  local cmd
  cmd="$(ps -o command= -p "$1" 2>/dev/null || true)"
  [[ "$cmd" == *slidev* ]]
}

# orphan_group <pid>: true when the leader is gone but its process group lives on.
orphan_group() {
  [ -n "${1:-}" ] && ! pid_alive "$1" && group_alive "$1"
}

# http_status <port>: HTTP status of GET / on localhost, 000 when unreachable.
http_status() {
  curl -s -o /dev/null -m 3 -w '%{http_code}' "http://localhost:$1/" 2>/dev/null || true
}

# page_title <port>: the <title> of the page served at /, empty when none.
page_title() {
  curl -s -m 3 "http://localhost:$1/" 2>/dev/null \
    | tr '\n' ' ' \
    | sed -n 's:.*<title>\([^<]*\)</title>.*:\1:p' \
    | head -n 1 || true
}

# Headmatter title of the deck entry, empty when missing or unreadable.
deck_title() {
  command -v yq >/dev/null 2>&1 || return 0
  yq --front-matter=extract '.title // ""' "$DECK_DIR/$ENTRY" 2>/dev/null || true
}

# serves_this_deck <port>: true only when the page title unambiguously matches
# the deck headmatter title. An empty title is ambiguous and never matches.
serves_this_deck() {
  local port="$1" want got
  want="$(deck_title)"
  [ -n "$want" ] || return 1
  [ "$(http_status "$port")" = "200" ] || return 1
  got="$(page_title "$port")"
  [ -n "$got" ] || return 1
  [ "$got" = "$want" ] || [ "$got" = "$want - Slidev" ]
}

# port_in_use <port>: true when something listens on the port.
port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  node -e '
    const net = require("node:net");
    const port = Number(process.argv[1]);
    const hosts = ["127.0.0.1", "::1"];
    let pending = hosts.length, used = false;
    for (const host of hosts) {
      const s = net.connect({ host, port });
      s.setTimeout(1000);
      const done = (ok) => { if (ok) used = true; s.destroy(); if (--pending === 0) process.exit(used ? 0 : 1); };
      s.once("connect", () => done(true));
      s.once("error", () => done(false));
      s.once("timeout", () => done(false));
    }' "$port"
}

# pick_free_port <exclude-port>: first free port in FIRST_FREE_PORT..LAST_FREE_PORT.
pick_free_port() {
  local exclude="${1:-}" port
  port="$FIRST_FREE_PORT"
  while [ "$port" -le "$LAST_FREE_PORT" ]; do
    if [ "$port" != "$exclude" ] && ! port_in_use "$port"; then
      printf '%s\n' "$port"
      return 0
    fi
    port=$((port + 1))
  done
  return 1
}

# Kill a process and all its descendants, children first.
kill_tree() {
  local sig="$1" pid="$2" child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$sig" "$child"
  done
  kill "-$sig" "$pid" 2>/dev/null || true
}

# group_alive <pgid>: true while any process of the group is alive.
group_alive() {
  pgrep -g "$1" >/dev/null 2>&1
}

# stop_server_pid <pid>: stop a server started by this script. The server runs
# as its own session and process group leader, so the whole group is signalled;
# without a group of its own the process tree is killed instead.
stop_server_pid() {
  local pid="$1" pgid waited=0
  pid_alive "$pid" || group_alive "$pid" || return 0
  pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
  if [ "$pgid" = "$pid" ] || { [ -z "$pgid" ] && group_alive "$pid"; }; then
    kill -TERM -- "-$pid" 2>/dev/null || true
    while group_alive "$pid" && [ "$waited" -lt 10 ]; do
      sleep 1
      waited=$((waited + 1))
    done
    if group_alive "$pid"; then
      kill -KILL -- "-$pid" 2>/dev/null || true
    fi
  else
    kill_tree TERM "$pid"
    while pid_alive "$pid" && [ "$waited" -lt 10 ]; do
      sleep 1
      waited=$((waited + 1))
    done
    pid_alive "$pid" && kill_tree KILL "$pid"
  fi
  return 0
}

# stop_entry <role>: stop the role's server when owned, then clear the entry.
# A server the presenter runs (owned=false) is never stopped, but its entry is
# cleared too, so the next start checks again that it still serves this deck.
stop_entry() {
  local role="$1" entry pid
  entry="$(registry_get "$role")"
  [ "$entry" != "null" ] || return 0
  if [ "$(jq -r '.owned' <<<"$entry")" = "true" ]; then
    pid="$(jq -r '.pid // empty' <<<"$entry")"
    if pid_is_slidev "$pid" || orphan_group "$pid"; then
      stop_server_pid "$pid"
    fi
    echo "SERVER $role stopped port=$(jq -r '.port' <<<"$entry")"
  else
    echo "SERVER $role released port=$(jq -r '.port' <<<"$entry")"
  fi
  registry_put "$role" null
}

# Remove registry entries that are stale: owned servers whose pid is dead or
# whose deck differs (those are stopped first), and unowned servers that no
# longer answer.
cleanup_stale() {
  local role entry pid deck port
  for role in main preview; do
    entry="$(registry_get "$role")"
    [ "$entry" != "null" ] || continue
    deck="$(jq -r '.deck // empty' <<<"$entry")"
    port="$(jq -r '.port // empty' <<<"$entry")"
    if [ "$(jq -r '.owned' <<<"$entry")" = "true" ]; then
      pid="$(jq -r '.pid // empty' <<<"$entry")"
      if ! pid_is_slidev "$pid"; then
        if orphan_group "$pid"; then stop_server_pid "$pid"; fi
        registry_put "$role" null
      elif [ -n "$deck" ] && [ "$deck" != "$DECK_DIR" ]; then
        stop_server_pid "$pid"
        registry_put "$role" null
      fi
    elif [ -z "$port" ] || [ "$(http_status "$port")" != "200" ]; then
      registry_put "$role" null
    fi
  done
}

# Create a minimal preview entry when none exists: the deck headmatter (without
# the first slide's own layout, background and class) and one "# preview" slide.
ensure_preview_placeholder() {
  local file="$DECK_DIR/$PREVIEW_ENTRY" head=""
  [ -f "$file" ] && return 0
  if [ "$(head -n 1 "$DECK_DIR/$ENTRY")" = "---" ]; then
    # yq keeps the leading document marker of the front matter; drop it.
    head="$(yq --front-matter=extract 'del(.layout, .background, .class)' "$DECK_DIR/$ENTRY" 2>/dev/null \
      | sed '1{/^---$/d;}' || true)"
  fi
  if [ -n "$head" ] && [ "$head" != "{}" ] && [ "$head" != "null" ]; then
    printf -- '---\n%s\n---\n\n# preview\n' "$head" >"$file"
  else
    printf '# preview\n' >"$file"
  fi
}

# Run a command as the leader of a new session and process group, so that
# stop can signal the server together with all its children.
new_session() {
  if command -v setsid >/dev/null 2>&1; then
    exec setsid "$@"
  fi
  exec perl -MPOSIX -e 'POSIX::setsid() or die "setsid: $!\n"; exec @ARGV or die "exec: $!\n"' "$@"
}

# print_log_tail <log>: last 20 lines of the server log on stderr.
print_log_tail() {
  echo "---- last 20 lines of $1 ----" >&2
  tail -n 20 "$1" >&2 2>/dev/null || true
}

server_line() {
  # server_line <role> <port> <owned>
  echo "SERVER $1 port=$2 owned=$3"
}

cmd_server_start() {
  local preview="$1" role entry existing port owned pid other_port log waited
  require_entry
  command -v curl >/dev/null 2>&1 || unavailable "curl not found on PATH"
  command -v yq >/dev/null 2>&1 || unavailable "yq not found on PATH"

  if [ "$preview" = "true" ]; then
    role="preview"
    entry="$PREVIEW_ENTRY"
    ensure_preview_placeholder
  else
    role="main"
    entry="$ENTRY"
  fi

  cleanup_stale

  # Reuse a live registered server for the same entry.
  existing="$(registry_get "$role")"
  if [ "$existing" != "null" ]; then
    port="$(jq -r '.port' <<<"$existing")"
    owned="$(jq -r '.owned' <<<"$existing")"
    # A server this script did not start can have been replaced by another deck's
    # server on the same port since it was registered: check the title again.
    if [ "$(jq -r '.entry' <<<"$existing")" = "$entry" ] && [ "$(http_status "$port")" = "200" ] \
      && { [ "$owned" = "true" ] || serves_this_deck "$port"; }; then
      server_line "$role" "$port" "$owned"
      return 0
    fi
    stop_entry "$role" >/dev/null
  fi

  # Reuse a server the presenter already runs on the default port for this deck.
  if [ "$role" = "main" ] && serves_this_deck "$DEFAULT_PORT"; then
    registry_put main "$(jq -cn --argjson port "$DEFAULT_PORT" --arg entry "$entry" --arg deck "$DECK_DIR" \
      '{pid: null, port: $port, entry: $entry, owned: false, deck: $deck}')"
    server_line main "$DEFAULT_PORT" false
    return 0
  fi

  # Start a new server from the deck's own Slidev install.
  [ -x "$DECK_DIR/node_modules/.bin/slidev" ] \
    || { echo "ERROR: Slidev is not installed in $DECK_DIR" >&2
         echo "Install the deck dependencies first: (cd \"$DECK_DIR\" && npm ci)  # or npm install" >&2
         exit "$EXIT_UNAVAILABLE"; }

  other_port=""
  if [ "$role" = "main" ]; then
    other_port="$(registry_get preview | jq -r '.port // empty')"
  else
    other_port="$(registry_get main | jq -r '.port // empty')"
  fi
  port="$(pick_free_port "$other_port")" \
    || die "$EXIT_FAIL" "no free port in $FIRST_FREE_PORT-$LAST_FREE_PORT"

  mkdir -p "$(balance_dir)"
  log="$(balance_dir)/server-$role.log"
  : >"$log"
  # No --remote: Slidev treats any --remote value (even "false") as a password
  # and binds to all interfaces. Without it the server listens on localhost only.
  (cd "$DECK_DIR" && new_session nohup npx slidev "$entry" --port "$port" --open false) \
    >>"$log" 2>&1 </dev/null &
  pid=$!
  registry_put "$role" "$(jq -cn --argjson pid "$pid" --argjson port "$port" --arg entry "$entry" --arg deck "$DECK_DIR" \
    '{pid: $pid, port: $port, entry: $entry, owned: true, deck: $deck}')"

  waited=0
  while [ "$(http_status "$port")" != "200" ]; do
    if ! pid_alive "$pid"; then
      echo "ERROR: Slidev dev server ($role) exited before answering on port $port" >&2
      print_log_tail "$log"
      stop_server_pid "$pid"
      registry_put "$role" null
      exit "$EXIT_FAIL"
    fi
    if [ "$waited" -ge "$SERVER_WAIT_SECONDS" ]; then
      echo "ERROR: Slidev dev server ($role) did not answer HTTP 200 on port $port within ${SERVER_WAIT_SECONDS}s" >&2
      print_log_tail "$log"
      stop_server_pid "$pid"
      registry_put "$role" null
      exit "$EXIT_FAIL"
    fi
    sleep 1
    waited=$((waited + 1))
  done

  server_line "$role" "$port" true
}

cmd_server_stop() {
  local role
  for role in main preview; do
    stop_entry "$role"
  done
  rm -f "$DECK_DIR/$PREVIEW_ENTRY"
}

# ---------------------------------------------------------------------------
# render, preview, contact-sheet, rhythm (node side in render.mjs)
# ---------------------------------------------------------------------------

RENDER_JS="$SCRIPT_DIR/render.mjs"

# Option values of the render subcommands (filled by parse_render_args).
OPT_RUN=""
OPT_ROUND=""
OPT_SLIDES=""
OPT_NAME=""
OPT_SLIDE_FILE=""
OPT_SPLIT="false"

# parse_render_args <allowed options...>: parse REST_ARGS for the listed options.
parse_render_args() {
  local allowed=" $* " i=0 arg val
  local -a args=(${REST_ARGS[@]+"${REST_ARGS[@]}"})
  while [ "$i" -lt "${#args[@]}" ]; do
    arg="${args[$i]}"
    case "$arg" in
      --split)
        [[ "$allowed" == *" --split "* ]] || die_usage "unknown argument: $arg"
        OPT_SPLIT="true"
        i=$((i + 1))
        continue
        ;;
      --run | --round | --slides | --name | --slide-file) ;;
      *) die_usage "unknown argument: $arg" ;;
    esac
    [[ "$allowed" == *" $arg "* ]] || die_usage "unknown argument: $arg"
    [ $((i + 1)) -lt "${#args[@]}" ] || die_usage "$arg needs a value"
    val="${args[$((i + 1))]}"
    case "$arg" in
      --run) OPT_RUN="$val" ;;
      --round) OPT_ROUND="$val" ;;
      --slides) OPT_SLIDES="$val" ;;
      --name) OPT_NAME="$val" ;;
      --slide-file) OPT_SLIDE_FILE="$val" ;;
    esac
    i=$((i + 2))
  done
}

# Absolute path of the run folder (created when missing).
run_dir_abs() {
  [ -n "$OPT_RUN" ] || die_usage "--run <dir> is required"
  mkdir -p "$OPT_RUN" || die "$EXIT_FAIL" "cannot create run folder $OPT_RUN"
  (cd "$OPT_RUN" && pwd)
}

# require_round [0]: --round must be a positive integer; with 0, round 0 is accepted too
# (the render baseline taken before the pass changes slides at pass start).
require_round() {
  [ -n "$OPT_ROUND" ] || die_usage "--round <n> is required"
  if [ "${1:-}" = "0" ] && [ "$OPT_ROUND" = "0" ]; then return 0; fi
  [[ "$OPT_ROUND" =~ ^[1-9][0-9]*$ ]] || die_usage "--round must be a positive integer: $OPT_ROUND"
}

# Make sure the render tooling is installed; keeps NOTICE lines, drops RENDER_READY.
ensure_ready() {
  (REST_ARGS=() && cmd_ensure) | sed '/^RENDER_READY /d'
}

# registry_port <role>: port of the role's registered server.
registry_port() {
  registry_get "$1" | jq -r '.port // empty'
}

render_node() {
  node "$RENDER_JS" "$@" --cache "$CACHE_DIR"
}

cmd_render() {
  parse_render_args --run --round --slides
  require_entry
  require_round 0
  local run port
  run="$(run_dir_abs)"
  # The run's slide map is used as is (the command keeps it current after splits
  # and merges); build it only when the run has none yet.
  if [ ! -f "$run/slide-map.json" ]; then
    node "$SCRIPT_DIR/slide-map.mjs" build --deck "$DECK_DIR" --entry "$ENTRY" --out "$run/slide-map.json" >&2 \
      || die "$EXIT_FAIL" "cannot build the slide map for $DECK_DIR/$ENTRY"
  fi
  local -a extra=()
  if [ -n "$OPT_SLIDES" ]; then
    # Validate the range before any server work (exit 2 names the valid range).
    render_node parse-range --map "$run/slide-map.json" --slides "$OPT_SLIDES" >/dev/null
    extra=(--slides "$OPT_SLIDES")
  fi
  ensure_ready
  cmd_server_start false
  port="$(registry_port main)"
  [ -n "$port" ] || die "$EXIT_FAIL" "no main dev server registered after server start"
  render_node render --deck "$DECK_DIR" --entry "$ENTRY" --port "$port" --run "$run" --round "$OPT_ROUND" \
    ${extra[@]+"${extra[@]}"}
}

# Add .balance-preview.md to the deck's own .gitignore when it has one.
ignore_preview_entry() {
  local gi="$DECK_DIR/.gitignore"
  [ -f "$gi" ] || return 0
  if ! awk -v a="$PREVIEW_ENTRY" -v b="/$PREVIEW_ENTRY" -v c="**/$PREVIEW_ENTRY" \
      '{ sub(/[ \t\r]+$/, "") } $0 == a || $0 == b || $0 == c { found = 1 } END { exit found ? 0 : 1 }' "$gi"; then
    if [ -s "$gi" ] && [ -n "$(tail -c 1 "$gi")" ]; then printf '\n' >>"$gi"; fi
    printf '%s\n' "$PREVIEW_ENTRY" >>"$gi"
  fi
}

cmd_preview() {
  parse_render_args --run --name --slide-file --split
  require_entry
  [ -n "$OPT_NAME" ] || die_usage "--name <name> is required"
  [[ "$OPT_NAME" =~ ^[A-Za-z0-9._-]+$ ]] || die_usage "--name may only contain letters, digits, '.', '_' and '-': $OPT_NAME"
  [ -n "$OPT_SLIDE_FILE" ] || die_usage "--slide-file <md> is required"
  [ -f "$OPT_SLIDE_FILE" ] || die_usage "slide file not found: $OPT_SLIDE_FILE"
  local run port slide_file count
  run="$(run_dir_abs)"
  slide_file="$(cd "$(dirname "$OPT_SLIDE_FILE")" && pwd)/$(basename "$OPT_SLIDE_FILE")"
  count="$(render_node count-slides --slide-file "$slide_file")"
  if [ "$OPT_SPLIT" = "true" ] && [ "${count:-0}" -lt 2 ]; then
    die_usage "--split needs a slide file with at least two slides separated by ---"
  fi
  # JSON is the only stdout payload of preview: everything else goes to stderr.
  ensure_ready >&2
  ignore_preview_entry
  mkdir -p "$run/previews"
  render_node preview-file --deck "$DECK_DIR" --entry "$ENTRY" --slide-file "$slide_file"
  cmd_server_start true >&2
  port="$(registry_port preview)"
  [ -n "$port" ] || die "$EXIT_FAIL" "no preview dev server registered after server start"
  render_node preview --deck "$DECK_DIR" --entry "$ENTRY" --port "$port" --run "$run" \
    --name "$OPT_NAME" --slide-file "$slide_file"
}

cmd_contact_sheet() {
  parse_render_args --run --round
  require_round
  local run
  run="$(run_dir_abs)"
  ensure_ready
  render_node contact-sheet --deck "$DECK_DIR" --run "$run" --round "$OPT_ROUND"
}

cmd_rhythm() {
  parse_render_args --run
  [ -n "$OPT_RUN" ] || die_usage "--run <dir> is required"
  [ -d "$OPT_RUN" ] || die_usage "run folder not found: $OPT_RUN"
  render_node rhythm --run "$(cd "$OPT_RUN" && pwd)"
}

cmd_server() {
  local action="" preview="false" arg
  for arg in ${REST_ARGS[@]+"${REST_ARGS[@]}"}; do
    case "$arg" in
      start | stop)
        [ -z "$action" ] || die_usage "server takes one action (start or stop)"
        action="$arg"
        ;;
      --preview) preview="true" ;;
      *) die_usage "unknown server argument: $arg" ;;
    esac
  done
  case "$action" in
    start) cmd_server_start "$preview" ;;
    stop)
      [ "$preview" = "false" ] || die_usage "--preview only applies to server start"
      cmd_server_stop
      ;;
    *) die_usage "server needs an action: start [--preview] | stop" ;;
  esac
}

# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

main() {
  if [ $# -eq 0 ]; then
    usage
    exit "$EXIT_USAGE"
  fi
  local sub="$1"
  shift
  case "$sub" in
    ensure)
      parse_common_args "$@"
      cmd_ensure
      ;;
    server)
      parse_common_args "$@"
      cmd_server
      ;;
    render)
      parse_common_args "$@"
      cmd_render
      ;;
    preview)
      parse_common_args "$@"
      cmd_preview
      ;;
    contact-sheet)
      parse_common_args "$@"
      cmd_contact_sheet
      ;;
    rhythm)
      parse_common_args "$@"
      cmd_rhythm
      ;;
    -h | --help | help)
      usage
      exit "$EXIT_OK"
      ;;
    *)
      echo "ERROR: unknown subcommand: $sub" >&2
      usage
      exit "$EXIT_USAGE"
      ;;
  esac
}

main "$@"
