#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_DIR=${WORKSPACE_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"}
PUBLIC_DIR=${PUBLIC_DIR:-"${WORKSPACE_DIR}/public"}
RUNTIME_DIR=${RUNTIME_DIR:-/srv/models.mddb.dev/www}
DRY_RUN=${DRY_RUN:-0}

if ! command -v rsync >/dev/null 2>&1; then
  echo "deploy-static-site: rsync is required" >&2
  exit 1
fi

cd "${WORKSPACE_DIR}"

if [[ -n "$(git status --short)" && "${ALLOW_DIRTY:-0}" != "1" ]]; then
  echo "deploy-static-site: refusing to deploy from a dirty workspace. Commit first or set ALLOW_DIRTY=1." >&2
  git status --short >&2
  exit 1
fi

npm test
npm run typecheck
npm run build

if [[ ! -f "${PUBLIC_DIR}/index.html" ]]; then
  echo "deploy-static-site: build output is missing required index.html in ${PUBLIC_DIR}" >&2
  exit 1
fi

RSYNC_ARGS=(-a --delete)
if [[ "${DRY_RUN}" == "1" ]]; then
  RSYNC_ARGS+=(--dry-run --itemize-changes)
fi

run_with_optional_sudo() {
  local target=$1
  shift
  if [[ -w "${target}" ]]; then
    "$@"
  else
    sudo -n "$@"
  fi
}

reload_nginx_if_possible() {
  if ! command -v systemctl >/dev/null 2>&1 || ! systemctl is-active --quiet nginx; then
    return 0
  fi
  if sudo -n true 2>/dev/null; then
    sudo -n nginx -t
    sudo -n systemctl reload nginx
  else
    echo "deploy-static-site: nginx reload skipped because passwordless sudo is unavailable" >&2
  fi
}

restart_update_admin_if_possible() {
  if [[ "${RESTART_UPDATE_ADMIN:-1}" != "1" ]]; then
    return 0
  fi
  if ! command -v systemctl >/dev/null 2>&1; then
    return 0
  fi
  if systemctl --user list-unit-files mddb-update-admin.service >/dev/null 2>&1; then
    systemctl --user restart mddb-update-admin.service
  fi
}

if [[ ! -d "${RUNTIME_DIR}" ]]; then
  sudo -n mkdir -p "${RUNTIME_DIR}"
fi
run_with_optional_sudo "${RUNTIME_DIR}" rsync "${RSYNC_ARGS[@]}" "${PUBLIC_DIR}/" "${RUNTIME_DIR}/"
run_with_optional_sudo "${RUNTIME_DIR}" find "${RUNTIME_DIR}" -type d -exec chmod 755 {} +
run_with_optional_sudo "${RUNTIME_DIR}" find "${RUNTIME_DIR}" -type f -exec chmod 644 {} +
reload_nginx_if_possible
restart_update_admin_if_possible

echo "deploy-static-site: deployed ${PUBLIC_DIR} -> ${RUNTIME_DIR}"
