# Phase 0 — Exit criteria record

**Date:** 2026-07-18  
**Plan:** `walkcroach/docs/walkcroach-desktop-ide-implementation-plan.md` § Phase 0

## Task matrix

| ID | Task | Artifact | Status |
|----|------|----------|--------|
| P0.1 | Pin `microsoft/vscode` + Electron/Node | `docs/phase-0/UPSTREAM_PIN.md` | ✅ |
| P0.2 | VSCodium / Open VSX gallery fields | `docs/phase-0/OPEN_VSX_GALLERY.md`, `product/product.walkcroach.json` | ✅ |
| P0.3 | Spike compile + launch empty branded window (Windows) | `spike/branded-window/` (Electron **42.6.0**, not full vscode compile) | ✅ |
| P0.4 | Signing procurement started | `docs/phase-0/SIGNING_PROCUREMENT.md` (USER must submit enrollments) | ✅ checklist / ⬜ account submission |
| P0.5 | Engine packaging decision + import proof | `docs/phase-0/ENGINE_PACKAGING.md`, `spike/engine-import/` | ✅ |
| P0.6 | Upstream owner + cadence checklist | `cadence/OWNER.md`, `cadence/CHECKLIST.md` | ✅ |
| P0.7 | Legal pass | `docs/phase-0/LEGAL_PASS.md` | ✅ |

## Exit criteria (plan)

| Criterion | Result |
|-----------|--------|
| Documented pin | ✅ `1.129.0` @ `125df4672b8a6a34975303c6b0baa124e560a4f7` |
| Successful empty branded build on ≥1 OS | ✅ Windows Electron spike (`npm run start:headless-smoke`) |
| Signing applications submitted | ⬜ **Blocked on human Apple/Azure enrollment** — checklist + steps ready |
| Engine import spike green | ✅ `spike/engine-import` tests |

## Explicit non-goals (Phase 0)

- Full `microsoft/vscode` clone + gulp compile (Phase A)
- Native agent / HostAdapter (Phase B)
- Production signing of release artifacts (Phase E)

## Verify command

```bash
cd walkcroach-desktop
npm run phase0:verify
```
