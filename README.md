# WalkCroach Desktop

VS Code / Code OSS **fork** delivery plane for WalkCroach. Shares the product monorepo’s `@walkcroach/agent-engine` and `/ide` control plane.

**Companion docs:** `walkcroach/docs/walkcroach-desktop-ide-prd.md`, `walkcroach-desktop-ide-implementation-plan.md`

## Status

| Phase | Status |
|-------|--------|
| Phase 0 — Research spike | ✅ |
| Phase A — Fork bootstrap | ✅ Structural (`npm run phaseA:verify`) |
| Phase B — Native agent | ✅ Structural (`npm run phaseB:verify`) |
| Phase C — CockroachDB panels | ✅ Structural (`npm run phaseC:verify`) |
| Phase D — Marketplace / migration | ✅ Structural (`npm run phaseD:verify`) |
| Phase E — Distribution / signing | ✅ Structural (`npm run phaseE:verify`) |
| **Phase F — Sustainability** | ✅ Structural (`npm run phaseF:verify`) — continuous cadence |

## Interim public distribution

**Windows portable `.zip` / `.exe`** (unsigned preview) + checksums.  
See [`docs/phase-E/INTERIM_DISTRIBUTION.md`](docs/phase-E/INTERIM_DISTRIBUTION.md).  
Not claimed as code-signed. Apple/Azure signing when budget allows.

## Layout

```text
walkcroach-desktop/
├── packages/desktop-agent/          # Node HostAdapter + session (Phase B)
├── product/                         # WalkCroach product overlay + curated recommendations
├── scripts/                         # apply-product, audits, sync-upstream, phase*-verify
├── cadence/                         # NFR-F12 owner + sync records
├── docs/phase-0|…|phase-F/ + decisions/ upstream/ surface-area/
├── infra/                           # Desktop-only update CDN + crash Lambda (TF)
├── packaging/                       # entitlements, release notes, manifest examples
├── spike/                           # Phase 0 Electron + engine-import spikes
└── vscode/                          # Nested clone of microsoft/vscode @ pin (own .git)
    └── src/vs/workbench/contrib/walkcroach/   # ALL fork product code
```

## Upstream pin

| | |
|--|--|
| Tag | `1.129.0` |
| Commit | `125df4672b8a6a34975303c6b0baa124e560a4f7` |
| Electron | `42.6.0` |
| Node (build) | `24.18.0` |

## Conventions

- Commit prefixes: `feat(walkcroach):`, `fix(walkcroach):`, `build:`, `sync(upstream):`
- Fork-only code **only** under `vscode/src/vs/workbench/contrib/walkcroach/`
- Minimal hooks allowed: `product.json`, single import in `workbench.common.main.ts`
- Open VSX **only** — never Microsoft Marketplace proxy
- Memory writes use `source_surface=desktop`
- Upstream sync ≤ 14 days — `cadence/`, `npm run sync:upstream:dry`

## Commands

```bash
# Phase F verify (cadence KPI + sustainability; includes Phase E)
npm run phaseF:verify
npm run cadence:kpi

# Desktop agent only
npm run test:desktop-agent

# Apply WalkCroach product.json onto vscode/
npm run apply:product

# Audits
npm run audit:recommendations
npm run audit:surface-area

# Upstream
npm run sync:upstream:dry
```

### Full compile / launch (needs ≥15GB free + Node 24.18.0)

See [`docs/phase-A/COMPILE.md`](docs/phase-A/COMPILE.md) and [`docs/phase-B/ENGINE_BRIDGE.md`](docs/phase-B/ENGINE_BRIDGE.md).

```bash
cd vscode
npm ci
npm run compile
# Windows: scripts\code.bat
# Sidebar → WalkCroach → Agent  |  F1 → WalkCroach: …
```

## License

WalkCroach product code: MIT. Upstream `microsoft/vscode` remains MIT; retain notices.
