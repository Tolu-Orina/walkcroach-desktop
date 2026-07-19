# Phase F — Exit criteria record (sustainability)

**Date:** 2026-07-19  
**Plan:** `walkcroach/docs/walkcroach-desktop-ide-implementation-plan.md` § Phase F

## Task matrix

| ID | Task | Artifact | Status |
|----|------|----------|--------|
| PF.1 | Biweekly upstream merge + conflict log | `sync-upstream.sh`, `docs/upstream/`, `cadence/records/` | ✅ |
| PF.2 | Cadence KPI (adherence + days-since-last) | `scripts/cadence-kpi.mjs` | ✅ |
| PF.3 | Quarterly surface-area review | `docs/surface-area/QUARTERLY.md` | ✅ |
| PF.4 | Decision log | `docs/decisions/` | ✅ |
| PF.5 | `upstream-candidate` label + triage | `LABELS.md`, issue form, label workflow | ✅ |
| PF.6 | Security patch fast-path | `docs/upstream/SECURITY_PATCH.md` | ✅ |

## Continuous exit

| Criterion | Result |
|-----------|--------|
| Never >14 days without recorded sync attempt | Enforced by `cadence-kpi` in `phaseF:verify` |
| Void-class freeze = P0 | Documented in `docs/upstream/README.md` |

## Also recorded this session

- Interim ship: Windows portable zip/exe — `docs/phase-E/INTERIM_DISTRIBUTION.md`

## Verify

```bash
npm run phaseF:verify
```
