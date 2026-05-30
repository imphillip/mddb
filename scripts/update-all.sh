#!/usr/bin/env bash
# Unified models.json refresh — ONE command for the whole update cycle:
#   ① fetch every source → ② assemble → ③ diff (guardrail) → ④ apply → ⑤ rebuild site + coverage gate
#
# Sources by currency: OpenRouter + LiteLLM (USD), Bailian + Volcengine (CNY). The Volcengine step
# needs a headless browser (Playwright); it is auto-skipped when Playwright is not installed and the
# committed sources/raw/volcengine/* are reused, so this script still runs anywhere.
#
# Guardrails: ③ update:check exits non-zero on a suspicious mass-removal (likely a source outage) and
# ⑤ the coverage gate exits non-zero on a regression — either aborts before commit.
#
# Env toggles (all default off):
#   DRY_RUN=1          stop after the diff report; never write data/models.json
#   SKIP_FETCH=1       skip all fetching; re-assemble + apply the already-committed raw sources
#   SKIP_VOLCENGINE=1  never run the Volcengine browser fetch (reuse committed markdown)
#   COMMIT=1           git add + commit data/models.json + sources/ after a successful apply
#   PUSH=1             implies COMMIT, then git push
#
# Examples:
#   npm run update:all                 # full refresh, leaves the commit to you
#   DRY_RUN=1 npm run update:all        # preview only (fetch + diff report, no write)
#   PUSH=1 npm run update:all           # cron: full refresh + commit + push
set -euo pipefail

WORKSPACE_DIR=${WORKSPACE_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"}
cd "${WORKSPACE_DIR}"

DRY_RUN=${DRY_RUN:-0}
SKIP_FETCH=${SKIP_FETCH:-0}
SKIP_VOLCENGINE=${SKIP_VOLCENGINE:-0}
COMMIT=${COMMIT:-0}
PUSH=${PUSH:-0}
[ "${PUSH}" = 1 ] && COMMIT=1

step() { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }

# ① FETCH
if [ "${SKIP_FETCH}" = 0 ]; then
  step "① fetch USD + CNY sources (OpenRouter / LiteLLM / Bailian)"
  npm run data:fetch
  if [ "${SKIP_VOLCENGINE}" = 0 ]; then
    if node -e "require.resolve('playwright')" >/dev/null 2>&1; then
      step "① fetch Volcengine (headless browser)"
      npm run data:volcengine
    else
      echo "⚠ Playwright not installed — skipping Volcengine fetch; reusing committed sources/raw/volcengine/*."
      echo "  To enable: npm i -D playwright && npx playwright install chromium"
    fi
  fi
else
  step "① SKIP_FETCH=1 — reusing committed raw sources"
fi

# ② ASSEMBLE
step "② assemble per-source views"
npm run data:assemble

# update:* run the compiled normalizer, so dist/ must be current
step "compile (dist/)"
npx tsc

# ③ DIFF + guardrail (exits non-zero on suspicious mass-removal)
step "③ diff candidate vs data/models.json (guardrail)"
if ! npm run update:check; then
  echo "✗ update:check failed (guardrail tripped or build error) — NOT applying. Review the report above." >&2
  exit 1
fi

if [ "${DRY_RUN}" = 1 ]; then
  step "DRY_RUN=1 — stopping before apply (data/models.json untouched)"
  exit 0
fi

# ④ APPLY
step "④ apply → data/models.json"
npm run update:apply

# ⑤ rebuild site + coverage-regression gate
step "⑤ rebuild site + coverage gate"
npm run data:quality

# ⑥ optional commit / push (only the refreshed artifacts)
if [ "${COMMIT}" = 1 ]; then
  step "⑥ commit"
  git add data/models.json sources/
  if git diff --cached --quiet; then
    echo "nothing to commit (no data change)"
  else
    git commit -m "data: refresh models.json ($(date +%F))"
    if [ "${PUSH}" = 1 ]; then
      step "⑥ push"
      git push
    fi
  fi
fi

step "done"
