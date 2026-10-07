#!/usr/bin/env bash
# Thinkollect VPS helper for an AI agent.
# Non-interactive. Safe defaults: no force-push, no secrets in commits.
#
# Usage:
#   ./scripts/vps-agent.sh deploy [--no-pull] [--no-restart]
#   ./scripts/vps-agent.sh restart
#   ./scripts/vps-agent.sh stop
#   ./scripts/vps-agent.sh status
#   ./scripts/vps-agent.sh save  [commit message]
#   ./scripts/vps-agent.sh push
#   ./scripts/vps-agent.sh save-push [commit message]
#
# One-time VPS setup:
#   git clone <repo> /opt/thinkollect
#   cd /opt/thinkollect
#   cp apps/api/.env.example apps/api/.env   # fill secrets
#   sudo cp scripts/thinkollect-api.service /etc/systemd/system/
#   sudo sed -i "s|/opt/thinkollect|$(pwd)|g" /etc/systemd/system/thinkollect-api.service
#   sudo systemctl daemon-reload
#   sudo systemctl enable thinkollect-api
#   ./scripts/vps-agent.sh deploy

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT/apps/api"
VENV="$API_DIR/.venv"
PID_FILE="$API_DIR/uvicorn.pid"
LOG_FILE="$API_DIR/uvicorn.log"
SERVICE_NAME="thinkollect-api"
HOST="${THINKOLLECT_HOST:-0.0.0.0}"
PORT="${THINKOLLECT_PORT:-8000}"
BRANCH="${THINKOLLECT_BRANCH:-}"

log() { printf '[vps-agent] %s\n' "$*"; }
die() { printf '[vps-agent] ERROR: %s\n' "$*" >&2; exit 1; }

require_repo() {
  [[ -d "$ROOT/.git" ]] || die "not a git repo: $ROOT"
  [[ -f "$API_DIR/main.py" ]] || die "API missing: $API_DIR/main.py"
}

has_systemd_unit() {
  command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files "$SERVICE_NAME.service" >/dev/null 2>&1
}

api_running() {
  if has_systemd_unit && systemctl is-active --quiet "$SERVICE_NAME"; then
    return 0
  fi
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    return 0
  fi
  return 1
}

cmd_stop() {
  if has_systemd_unit; then
    sudo systemctl stop "$SERVICE_NAME" || true
  fi
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
  log "API stopped"
}

cmd_restart() {
  [[ -f "$API_DIR/.env" ]] || die "missing $API_DIR/.env — copy .env.example and fill it in"
  [[ -x "$VENV/bin/uvicorn" ]] || die "venv not ready — run: $0 deploy"

  if has_systemd_unit; then
    sudo systemctl restart "$SERVICE_NAME"
    sudo systemctl --no-pager --full status "$SERVICE_NAME" | head -n 12
    return
  fi

  cmd_stop
  (
    cd "$API_DIR"
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
    nohup "$VENV/bin/uvicorn" main:app --host "$HOST" --port "$PORT" \
      >>"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE"
  )
  sleep 1
  if api_running; then
    log "API started on ${HOST}:${PORT} (pid $(cat "$PID_FILE"))"
  else
    die "API failed to start — see $LOG_FILE"
  fi
}

setup_venv() {
  if [[ ! -x "$VENV/bin/python" ]]; then
    log "creating venv"
    python3 -m venv "$VENV"
  fi
  log "installing API dependencies"
  "$VENV/bin/pip" install -q --upgrade pip
  "$VENV/bin/pip" install -q -r "$API_DIR/requirements.txt"
}

cmd_deploy() {
  local do_pull=1
  local do_restart=1
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --no-pull) do_pull=0 ;;
      --no-restart) do_restart=0 ;;
      *) die "unknown deploy flag: $1" ;;
    esac
    shift
  done

  require_repo
  cd "$ROOT"

  if [[ "$do_pull" -eq 1 ]]; then
    if [[ -n "$(git status --porcelain)" ]]; then
      log "working tree dirty — skipping git pull (commit first with: $0 save-push)"
    else
      git fetch --all --prune
      local branch="${BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
      log "pulling $branch"
      git pull --ff-only origin "$branch"
    fi
  fi

  [[ -f "$API_DIR/.env" ]] || die "missing $API_DIR/.env — copy .env.example and fill it in"
  setup_venv

  if [[ "$do_restart" -eq 1 ]]; then
    cmd_restart
  else
    log "deploy complete (restart skipped)"
  fi
}

safe_add() {
  git add -A
  # Never stage secrets or local runtime junk, even if someone un-ignored them.
  git reset -q -- \
    '*.env' \
    '*.env.local' \
    'apps/api/.venv' \
    'apps/api/.venv/**' \
    '**/__pycache__/**' \
    'apps/api/uvicorn.pid' \
    'apps/api/uvicorn.log' \
    2>/dev/null || true
}

cmd_save() {
  require_repo
  cd "$ROOT"
  local message="${1:-agent: save work on $(date -u +%Y-%m-%dT%H:%M:%SZ)}"

  safe_add
  if git diff --cached --quiet; then
    log "nothing to commit"
    return 0
  fi

  git commit -m "$(cat <<EOF
${message}

EOF
)"
  log "committed $(git rev-parse --short HEAD)"
}

cmd_push() {
  require_repo
  cd "$ROOT"
  local branch="${BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
  if [[ "$branch" == "HEAD" ]]; then
    die "detached HEAD — checkout a branch before push"
  fi
  if [[ "$branch" == "main" || "$branch" == "master" ]]; then
    log "pushing $branch (ff-only remote update, no force)"
  fi
  git push -u origin "$branch"
  log "pushed $branch"
}

cmd_save_push() {
  cmd_save "${1:-}"
  cmd_push
}

cmd_status() {
  require_repo
  cd "$ROOT"
  echo "repo:    $ROOT"
  echo "branch:  $(git rev-parse --abbrev-ref HEAD)"
  echo "commit:  $(git rev-parse --short HEAD) $(git log -1 --pretty=%s)"
  echo "dirty:   $([[ -n "$(git status --porcelain)" ]] && echo yes || echo no)"
  if api_running; then
    echo "api:     running"
  else
    echo "api:     stopped"
  fi
  if has_systemd_unit; then
    systemctl is-active --quiet "$SERVICE_NAME" && echo "systemd: active" || echo "systemd: inactive"
  else
    echo "systemd: not installed"
  fi
}

usage() {
  sed -n '2,18p' "$0"
}

main() {
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    deploy) cmd_deploy "$@" ;;
    restart) require_repo; cmd_restart ;;
    stop) require_repo; cmd_stop ;;
    status) cmd_status ;;
    save) cmd_save "${1:-}" ;;
    push) cmd_push ;;
    save-push|save_push) cmd_save_push "${1:-}" ;;
    -h|--help|help|"") usage ;;
    *) die "unknown command: $cmd (try: deploy|save|push|save-push|status)" ;;
  esac
}

main "$@"
