# Phase C — CockroachDB native panels

**Date:** 2026-07-19  
**Plan:** `walkcroach/docs/walkcroach-desktop-ide-implementation-plan.md` § Phase C

## Task matrix

| ID | Task | Artifact | Status |
|----|------|----------|--------|
| PC.1 | Schema browser via MCP (demo + live path) | `WalkCroachSchemaViewPane` + `CrdbPanelSession.listSchema` | ✅ |
| PC.2 | Query runner read-only + write confirm | `WalkCroachQueryViewPane` + `runQuery` | ✅ |
| PC.3 | Audit-log viewer | `WalkCroachAuditViewPane` + session audit | ✅ |
| PC.4 | Memory/recall with surface labels | `WalkCroachMemoryViewPane` + `/ide` recall | ✅ |
| PC.5 | ccloud hard per-action confirmation | `WalkCroachCcloudViewPane` + confirm controller | ✅ |
| PC.6 | Progressive Skills load | `WalkCroachSkillsViewPane` + registry | ✅ |
| PC.7 | Telemetry counters | Telemetry pane + status bar; `recalls_by_surface` | ✅ |
| PC.8 | Demo script | `docs/phase-C/DEMO.md` + F1 `walkcroach.demo.phaseC` | ✅ |

## Exit criteria

| Criterion | Result |
|-----------|--------|
| Judge path: MCP + memory + ccloud gate + Skills without extension sidebar | ✅ structural (demo fixtures; live MCP via desktop-agent when bridged) |
| Write blocked by default | ✅ |
| ccloud never auto-approved | ✅ |
| Surface labels on recall | ✅ web/chrome/ide/desktop |

## Verify

```bash
npm run phaseC:verify
```
