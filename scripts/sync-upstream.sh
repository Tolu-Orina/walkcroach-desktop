#!/usr/bin/env bash
# PA.4 / NFR-F12 — Upstream sync against microsoft/vscode.
# Usage:
#   ./scripts/sync-upstream.sh --dry-run
#   ./scripts/sync-upstream.sh --dry-run --fetch
#   ./scripts/sync-upstream.sh
#   ./scripts/sync-upstream.sh --target 1.130.0
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VSCODE_DIR="${ROOT}/vscode"
DRY_RUN=0
DO_FETCH=0
TARGET=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --fetch) DO_FETCH=1; shift ;;
    --target) TARGET="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--dry-run] [--fetch] [--target <tag-or-sha>]"
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ ! -d "${VSCODE_DIR}/.git" ]]; then
  echo "error: ${VSCODE_DIR} is not a git checkout of microsoft/vscode"
  exit 1
fi

cd "${VSCODE_DIR}"
git config core.longpaths true

if ! git remote get-url upstream >/dev/null 2>&1; then
  git remote add upstream https://github.com/microsoft/vscode.git
fi

CURRENT="$(git rev-parse HEAD)"
CURRENT_SHORT="$(git rev-parse --short HEAD)"
BRANCH="$(git branch --show-current 2>/dev/null || echo detached)"

echo "current: ${CURRENT_SHORT} (${CURRENT})"
echo "branch:  ${BRANCH}"
echo "upstream remote: $(git remote get-url upstream)"

if [[ "${DRY_RUN}" -eq 1 ]]; then
  if [[ "${DO_FETCH}" -eq 1 ]]; then
    echo "==> fetch upstream (optional for dry-run)"
    git fetch upstream --tags --prune
  else
    echo "==> dry-run: skipping network fetch (pass --fetch to update remotes)"
  fi
  echo "==> local tags matching 1.129.*"
  git tag -l '1.129.*' | head -5 || true
  echo "==> recent commits"
  git log --oneline -3 HEAD || true
  echo "dry-run OK"
  exit 0
fi

# Real sync always fetches
echo "==> fetch upstream"
git fetch upstream --tags --prune

if [[ -z "${TARGET}" ]]; then
  TARGET="$(git tag -l '[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -1 || true)"
  if [[ -z "${TARGET}" ]]; then
    TARGET="upstream/main"
  fi
fi

echo "target:  ${TARGET}"

STAMP="$(date -u +%Y-%m-%d)"
BRANCH_NAME="sync/upstream-${STAMP}"
git switch -c "${BRANCH_NAME}" 2>/dev/null || git switch "${BRANCH_NAME}"

echo "==> merge ${TARGET}"
set +e
git merge --no-ff --no-edit "${TARGET}"
MERGE_STATUS=$?
set -e

RECORD_DIR="${ROOT}/cadence/records"
mkdir -p "${RECORD_DIR}"
RECORD="${RECORD_DIR}/${STAMP}.md"
UPSTREAM_DIR="${ROOT}/cadence/upstream"
mkdir -p "${UPSTREAM_DIR}"

{
  echo "# Upstream sync ${STAMP}"
  echo
  echo "- Branch: \`${BRANCH_NAME}\`"
  echo "- From: \`${CURRENT}\`"
  echo "- Target: \`${TARGET}\`"
  echo "- Merge exit: ${MERGE_STATUS}"
  echo "- Conflicts: see git status if non-zero"
  echo
  echo "## Checklist"
  echo "- [ ] Compile + smoke launch"
  echo "- [ ] \`npm run audit:recommendations\`"
  echo "- [ ] \`npm run audit:surface-area\`"
  echo "- [ ] Release notes: Upstream absorbed vs WalkCroach-specific"
  echo "- [ ] Update \`cadence/upstream/README.md\` if conflicts"
} > "${RECORD}"

if [[ "${MERGE_STATUS}" -ne 0 ]]; then
  CONFLICT_DOC="${UPSTREAM_DIR}/${STAMP}-conflicts.md"
  {
    echo "# Upstream conflicts — ${STAMP}"
    echo
    echo "- Target: \`${TARGET}\`"
    echo "- Branch: \`${BRANCH_NAME}\`"
    echo
    echo "| Path | Resolution | Why |"
    echo "|------|------------|-----|"
    echo "| _(fill)_ | | Prefer \`contrib/walkcroach/\` |"
    echo
    echo "## Notes"
    echo
    echo '```'
    git status --short || true
    echo '```'
  } > "${CONFLICT_DOC}"
  echo "wrote conflict stub ${CONFLICT_DOC}"
fi

echo "wrote ${RECORD}"
if [[ "${MERGE_STATUS}" -ne 0 ]]; then
  echo "merge reported conflicts or failure — resolve under contrib/walkcroach/ preference"
  exit "${MERGE_STATUS}"
fi

echo "sync OK"
