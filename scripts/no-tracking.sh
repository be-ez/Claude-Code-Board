#!/usr/bin/env sh
#
# no-tracking.sh — strip third-party trackers/analytics from this checkout.
#
# Designed to stay merge-friendly with upstream:
#   * everything it changes is either gitignored (.env files) or a plain
#     line-deletion in index.html, so `git pull` never fights it
#   * it is idempotent — run it as often as you like
#   * `check` fails loudly if upstream introduces a NEW tracker
#
# Usage:
#   sh scripts/no-tracking.sh apply     # disable tracking (default)
#   sh scripts/no-tracking.sh check     # report only, non-zero exit if dirty
#   sh scripts/no-tracking.sh restore   # put upstream's trackers back
#
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CMD=${1:-apply}

INDEX_HTML="$ROOT/frontend/index.html"
ENV_FILES=".env .env.dev"

BEGIN_MARK="# >>> no-tracking (managed by scripts/no-tracking.sh) >>>"
END_MARK="# <<< no-tracking (managed by scripts/no-tracking.sh) <<<"

# Hosts that are ours / not third-party egress.
LOCAL_HOSTS='localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]'

# Known tracker/analytics signatures, used by the scanner so that a tracker
# added upstream later gets flagged instead of silently shipping.
TRACKER_HOSTS='fonts\.googleapis\.com|fonts\.gstatic\.com|google-analytics\.com|googletagmanager\.com|doubleclick\.net|connect\.facebook\.net|static\.hotjar\.com|cdn\.mxpnl\.com|api\.mixpanel\.com|cdn\.segment\.com|api\.segment\.io|sentry\.io|posthog\.com|amplitude\.com|fullstory\.com|logrocket\.(io|com)|bugsnag\.com|rollbar\.com|datadoghq\.com|clarity\.ms|plausible\.io|matomo\.|umami\.|statsig\.com|browser-intake-'
TRACKER_PKGS='@sentry/|posthog-js|mixpanel|amplitude-js|@amplitude/|react-ga|@vercel/analytics|logrocket|@datadog/|react-hotjar|@segment/|analytics-node|newrelic'

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
ylw()  { printf '\033[33m%s\033[0m\n' "$*"; }
bold() { printf '\033[1m%s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------
# 1. Frontend: third-party <link>/<script> tags in index.html
#    (upstream ships a Google Fonts stylesheet, which leaks every visitor's
#    IP + User-Agent to Google on page load)
# ---------------------------------------------------------------------------

html_offenders() {
  [ -f "$INDEX_HTML" ] || return 0
  grep -nE '(href|src)[[:space:]]*=[[:space:]]*["'\'']https?://' "$INDEX_HTML" \
    | grep -vE "$LOCAL_HOSTS" || true
}

html_apply() {
  offenders=$(html_offenders)
  if [ -z "$offenders" ]; then
    grn "  frontend/index.html      already clean"
    return 0
  fi
  # Reuse the line numbers grep already found, so there is exactly one
  # place where "what counts as third-party" is defined.
  drop=$(printf '%s\n' "$offenders" | cut -d: -f1 | tr '\n' ',')
  tmp="$INDEX_HTML.no-tracking.tmp"
  awk -v drop="$drop" '
    BEGIN { n = split(drop, a, ","); for (i = 1; i <= n; i++) if (a[i] != "") d[a[i]] = 1 }
    !(FNR in d)
  ' "$INDEX_HTML" > "$tmp"
  mv "$tmp" "$INDEX_HTML"
  ylw "  frontend/index.html      removed:"
  printf '%s\n' "$offenders" | sed 's/^/      /'
}

html_restore() {
  if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
    git -C "$ROOT" checkout -- frontend/index.html 2>/dev/null \
      && grn "  frontend/index.html      restored from git" \
      || ylw "  frontend/index.html      nothing to restore"
  else
    red "  frontend/index.html      not a git checkout, cannot restore"
  fi
}

# ---------------------------------------------------------------------------
# 2. Backend: the Claude CLI that this app spawns has its own telemetry,
#    crash reporting and auto-updater. The spawn sites inherit process.env
#    (backend/src/services/{ProcessManager,StreamProcessor,
#    UnifiedStreamProcessor}.ts), so opting out in the env files that the
#    backend loads via dotenv reaches every spawned `claude` process.
# ---------------------------------------------------------------------------

env_block() {
  cat <<BLOCK
$BEGIN_MARK
# Opt the spawned Claude CLI out of all non-essential network traffic.
# Do not edit by hand — re-run: npm run no-tracking
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
DISABLE_TELEMETRY=1
DISABLE_ERROR_REPORTING=1
DISABLE_BUG_COMMAND=1
DISABLE_AUTOUPDATER=1
DISABLE_NON_ESSENTIAL_MODEL_CALLS=1
CLAUDE_CODE_ENABLE_TELEMETRY=0
$END_MARK
BLOCK
}

env_strip() { # $1 = file ; prints file contents minus any managed block
  awk -v b="$BEGIN_MARK" -v e="$END_MARK" '
    $0 == b { skip = 1 }
    skip != 1 { print }
    $0 == e { skip = 0 }
  ' "$1"
}

env_apply() {
  for f in $ENV_FILES; do
    path="$ROOT/$f"
    if [ -f "$path" ] && grep -qF "$BEGIN_MARK" "$path" 2>/dev/null; then
      # Rewrite in place so the block always matches this script's version.
      { env_strip "$path"; env_block; } > "$path.no-tracking.tmp"
      mv "$path.no-tracking.tmp" "$path"
      grn "  $f$(printf '%*s' $((24 - ${#f})) '')up to date"
    elif [ -f "$path" ]; then
      printf '\n' >> "$path"
      env_block >> "$path"
      ylw "  $f$(printf '%*s' $((24 - ${#f})) '')opt-out block added"
    else
      env_block > "$path"
      ylw "  $f$(printf '%*s' $((24 - ${#f})) '')created with opt-out block"
    fi
  done
}

env_check() {
  missing=0
  for f in $ENV_FILES; do
    path="$ROOT/$f"
    if [ -f "$path" ] && grep -qF "$BEGIN_MARK" "$path" 2>/dev/null; then
      grn "  $f$(printf '%*s' $((24 - ${#f})) '')opt-out present"
    else
      red "  $f$(printf '%*s' $((24 - ${#f})) '')opt-out MISSING"
      missing=1
    fi
  done
  return $missing
}

env_restore() {
  for f in $ENV_FILES; do
    path="$ROOT/$f"
    [ -f "$path" ] || continue
    env_strip "$path" > "$path.no-tracking.tmp"
    mv "$path.no-tracking.tmp" "$path"
    # Drop the file entirely if we created it and it now holds nothing useful.
    if [ ! -s "$path" ] || ! grep -qE '^[A-Za-z_][A-Za-z0-9_]*=' "$path"; then
      rm -f "$path"
      grn "  $f$(printf '%*s' $((24 - ${#f})) '')removed"
    else
      grn "  $f$(printf '%*s' $((24 - ${#f})) '')opt-out block removed"
    fi
  done
}

# ---------------------------------------------------------------------------
# 3. Scanner — catches anything new that arrives from upstream
# ---------------------------------------------------------------------------

scan() {
  found=0

  hits=$(grep -rnE "$TRACKER_HOSTS" \
          --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
          --include='*.html' --include='*.css' --include='*.json' \
          --exclude='package-lock.json' --exclude-dir=node_modules \
          --exclude-dir=dist --exclude-dir=.git \
          "$ROOT" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    red "  tracker hosts referenced in source:"
    printf '%s\n' "$hits" | sed "s|$ROOT/||" | sed 's/^/      /'
    found=1
  fi

  pkgs=$(grep -rnE "\"($TRACKER_PKGS)" \
          "$ROOT/package.json" "$ROOT/frontend/package.json" \
          "$ROOT/backend/package.json" 2>/dev/null || true)
  if [ -n "$pkgs" ]; then
    red "  analytics packages declared as dependencies:"
    printf '%s\n' "$pkgs" | sed "s|$ROOT/||" | sed 's/^/      /'
    found=1
  fi

  [ "$found" -eq 0 ] && grn "  no known tracker signatures found"
  return $found
}

# ---------------------------------------------------------------------------

case "$CMD" in
  apply)
    bold "no-tracking: disabling trackers and analytics"
    echo "Frontend"
    html_apply
    echo "Claude CLI telemetry"
    env_apply
    echo "Scan"
    scan || true
    echo
    grn "Done. Re-run this after every upstream pull (npm run no-tracking)."
    ;;
  check)
    bold "no-tracking: checking"
    status=0
    echo "Frontend"
    offenders=$(html_offenders)
    if [ -n "$offenders" ]; then
      red "  frontend/index.html      third-party requests present:"
      printf '%s\n' "$offenders" | sed 's/^/      /'
      status=1
    else
      grn "  frontend/index.html      clean"
    fi
    echo "Claude CLI telemetry"
    env_check || status=1
    echo "Scan"
    scan || status=1
    echo
    if [ "$status" -eq 0 ]; then
      grn "All clear — no tracking enabled."
    else
      red "Tracking is enabled. Run: npm run no-tracking"
    fi
    exit "$status"
    ;;
  restore)
    bold "no-tracking: restoring upstream behaviour (re-enables tracking)"
    echo "Frontend"
    html_restore
    echo "Claude CLI telemetry"
    env_restore
    ;;
  *)
    echo "usage: sh scripts/no-tracking.sh [apply|check|restore]" >&2
    exit 2
    ;;
esac
