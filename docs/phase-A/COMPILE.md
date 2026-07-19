# Full vscode compile notes (Phase A)

**Disk reality (this machine, 2026-07-19):** C: had ~4GB free after clone. A full `npm ci` + Electron download for `microsoft/vscode@1.129.0` typically needs **≥15GB** free. Structural Phase A is complete without waiting on that.

## Prerequisites

| Requirement | Pin |
|-------------|-----|
| Node | **24.18.0** (vscode `.nvmrc`) |
| Electron | **42.6.0** (vscode `.npmrc` `target`) |
| Upstream | `1.129.0` @ `125df4672b8a6a34975303c6b0baa124e560a4f7` |
| Windows | `git config core.longpaths true` (required) |

## Commands (when disk allows)

```bash
cd walkcroach-desktop
node scripts/apply-product.mjs
cd vscode
# Use Node 24.18.0
npm ci
npm run compile          # or: npm run watch
# Launch Code - OSS / WalkCroach:
./scripts/code.bat       # Windows
# F1 → "WalkCroach: About"
```

## Phase A structural exit (no full compile)

```bash
cd walkcroach-desktop
npm run phaseA:verify
```

This validates pin, product overlay (Open VSX + telemetry off), contrib registration hook, empty curated recommendations, surface-area budget, and upstream sync dry-run.
