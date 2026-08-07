# WalkCroach Desktop

VS Code / Code OSS **fork** delivery plane for WalkCroach. Shares `@walkcroach/agent-engine` and the `/ide` control plane with the sibling `walkcroach/` monorepo.

**Docs (only three):**

| Doc | Contents |
|-----|----------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layout, layering, UI map, data flows |
| [`docs/STATUS.md`](docs/STATUS.md) | What works, stubs, bugs, deep-review backlog |
| [`docs/SHIPPING.md`](docs/SHIPPING.md) | Pin, compile, unsigned preview package/release |

Monorepo pointer: `walkcroach/docs/walkcroach-desktop.md`

## Status (short)

Native agent path + Path B Agents Window + fleet soft-cap are implemented. CRDB panels are mostly demo. Public ship = **unsigned Windows portable** tooling (first Release is an operator step). Details: STATUS.md.

## Layout

```text
walkcroach-desktop/
├── packages/desktop-agent/          # HostAdapter + session (Node)
├── packages/agent-ui/               # React → agent-ui.js / settings-ui.js
├── product/                         # Overlay + allowlist + curated lists
├── scripts/                         # apply-product, audits, packaging, verify
├── packaging/                       # Release notes, entitlements, dist/
├── infra/                           # Update S3 + crash Lambda
├── cadence/                         # Upstream cadence + conflict logs
├── docs/                            # ARCHITECTURE · STATUS · SHIPPING
└── vscode/                          # Nested microsoft/vscode @ pin (own .git)
```

## Upstream pin

| | |
|--|--|
| Tag | `1.131.0` |
| Commit | `3a03d6f72d628a7741c29f456b4ddbb5ae68502c` |
| Electron | `42.7.0` |
| Node (build) | `24.18.0` |

## Conventions

- Commit prefixes: `feat(walkcroach):`, `fix(walkcroach):`, `build:`, `sync(upstream):`
- Fork-only code under allowlisted paths (`contrib/walkcroach/`, Agent Host `walkcroach/`, …)
- Open VSX **only** — never Microsoft Marketplace proxy
- Memory writes use `source_surface=desktop`
- Upstream sync ≤ 14 days — `cadence/`, `npm run sync:upstream:dry`

## Commands

```bash
npm run verify              # full product gate (audits + tests + cadence)
npm run verify:fast         # wiring + audits only (CI-friendly)
npm run apply:product
npm run audit:recommendations
npm run audit:surface-area

# Unsigned Windows portable (needs nested vscode/ + sibling walkcroach/)
npm run package:engine-bundle
npm run package:windows-portable
npm run release:windows-portable -- --tag desktop-v0.1.0-preview.1

npm run sync:upstream:dry
```

### Full compile / launch

See [`docs/SHIPPING.md`](docs/SHIPPING.md).
