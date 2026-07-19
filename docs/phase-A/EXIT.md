# Phase A — Exit criteria record

**Date:** 2026-07-19  
**Plan:** `walkcroach/docs/walkcroach-desktop-ide-implementation-plan.md` § Phase A

## Task matrix

| ID | Task | Artifact | Status |
|----|------|----------|--------|
| PA.1 | Clone pinned vscode + `upstream` remote | `vscode/` @ `125df467…`, remote `upstream` | ✅ |
| PA.2 | Replace `product.json` | `scripts/apply-product.mjs` → Open VSX, telemetry off, WalkCroach identity | ✅ |
| PA.3 | Scaffold `contrib/walkcroach/` + register | `vscode/src/vs/workbench/contrib/walkcroach/` + hook in `workbench.common.main.ts` | ✅ |
| PA.4 | `sync-upstream.sh` + CI | `scripts/sync-upstream.sh`, `.github/workflows/upstream-sync.yml` | ✅ |
| PA.5 | Surface-area budget | `scripts/audit-surface-area.mjs`, `product/surface-area-allowlist.txt` | ✅ |
| PA.6 | Empty curated recommendations + audit | `product/recommendations.curated.json` `[]`, `scripts/audit-recommendations.mjs` | ✅ |
| PA.7 | Issue template triage | `.github/ISSUE_TEMPLATE/bug_report.yml` | ✅ (from Phase 0 / F) |
| PA.8 | README build/launch/sync | `README.md` | ✅ |
| PA.9 | First upstream sync record | `cadence/records/2026-07-19-phase-a-bootstrap.md` | ✅ |

## Exit criteria

| Criterion | Result |
|-----------|--------|
| Internal builds install | ⏳ Deferred — disk &lt; full `npm ci` budget; see `COMPILE.md` |
| Open VSX reachable in product.json | ✅ |
| Telemetry off by default | ✅ `enableTelemetry: false` |
| Sync script run once with written record | ✅ dry-run + bootstrap record |
| Contrib directory present + registered | ✅ |
| Zero inherited recommendation IDs | ✅ empty curated list + cleared tip maps |

## Verify

```bash
npm run phaseA:verify
```
