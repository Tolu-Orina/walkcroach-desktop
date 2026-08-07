# WalkCroach Desktop — Architecture

**Repo:** `walkcroach-desktop/`  
**Companion (product truth for the monorepo):** `walkcroach/docs/walkcroach-desktop.md`  
**Status detail:** [`STATUS.md`](./STATUS.md) · **Build / ship:** [`SHIPPING.md`](./SHIPPING.md)

This document describes **how the product is structured in code today** — not historical phase plans.

---

## 1. What it is

WalkCroach Desktop is a **Code OSS fork** that embeds WalkCroach’s agent engine in the VS Code **Agent Host** process and hosts WalkCroach UI under `contrib/walkcroach/`.

It is **not**:

- An Electron shell around the VS Code extension
- A Microsoft Marketplace–proxied build
- A signed “general release” (public ship is unsigned Windows portable preview — see SHIPPING)

Shared brain with other surfaces: `@walkcroach/agent-engine` in the sibling `walkcroach/` monorepo. Shared control plane: WalkCroach BFF `/ide` (auth, project link, memory).

---

## 2. Repository layout

```text
walkcroach-desktop/
├── packages/
│   ├── desktop-agent/     # HostAdapter + session runner (Node; no workbench imports)
│   └── agent-ui/          # React webviews → agent-ui.js / settings-ui.js
├── product/               # Overlay JSON, allowlist, curated gallery lists
├── scripts/               # apply-product, audits, packaging, phase verify, upstream sync
├── packaging/             # Release-note templates, mac entitlements, dist/ (local)
├── infra/                 # desktop-update (S3), desktop-crash (Lambda + HTTP API)
├── cadence/               # Upstream cadence owner + records (not product docs)
├── docs/                  # ARCHITECTURE · STATUS · SHIPPING (this set)
└── vscode/                # Nested microsoft/vscode checkout (own .git; gitignored by parent)
    └── src/vs/
        ├── platform/agentHost/node/walkcroach/   # Agent Host provider
        ├── platform/agentHost/common/walkcroach* # Shared turn/RPC codecs
        └── workbench/contrib/walkcroach/         # All product UI
```

Parent git does **not** track `vscode/`. Fork code lives in the nested checkout; packaging and full compile require that tree on disk.

---

## 3. Layering (hard rules)

| Layer | May import | Must not |
|-------|------------|----------|
| `contrib/walkcroach/**` (renderer) | workbench services, AHP client | `@walkcroach/agent-engine`, AWS SDK |
| `platform/agentHost/node/walkcroach/**` | platform, Node | `workbench/**` |
| `packages/desktop-agent` | `@walkcroach/agent-engine`, Node | `vscode` / workbench |
| `packages/agent-ui` | React only | agent-engine, workbench |

Credentials and `runAgentLoop` run in the **Agent Host** (utility process), not the window renderer.

Surface-area allowlist: `product/surface-area-allowlist.txt`, enforced by `npm run audit:surface-area`.

---

## 4. Runtime path (one agent turn)

```text
Agent / Agents Window webview (agent-ui.js)
        │  postMessage protocol v2
        ▼
WalkCroachAgentService + WalkCroachAgentBridge (workbench)
        │  AHP over Agent Host Protocol
        ▼
WalkCroachAgent (platform/agentHost/node/walkcroach)
        │  startEngineTurn → load desktop-agent
        ▼
@walkcroach/desktop-agent  (dist/index.js  OR  media/engine-bundle.cjs)
        │  DesktopHostAdapter + startDesktopSession
        ▼
@walkcroach/agent-engine runAgentLoop  (Bedrock / tools / memory bridge)
```

**Engine load order** (`walkcroachEngineRuntime.ts`):

1. `{appRoot}/../packages/desktop-agent/dist/index.js` (dev)
2. `{appRoot}/packages/desktop-agent/dist/index.js`
3. `{appRoot}/out/.../walkcroach/media/engine-bundle.cjs` (packaged)
4. Beside compiled module / legacy `.js` names

Packaged bundle is **CJS** (`createRequire`) because AWS SDK / MCP are CommonJS-heavy; ESM esbuild shims break on `require('node:…')`.

---

## 5. UI surface map (registered)

### Auxiliary bar — `workbench.view.walkcroach`

| View ID | Title | Implementation |
|---------|-------|----------------|
| `…chat` | Agent | Webview → `agent-ui.js` |
| `…memory` | Memory | Native pane; live BFF when linked, else demo |
| `…migration` | Import | Migration scan/import (hidden by default) |
| `…incompatibles` | Incompatibles | Proprietary catalog (hidden) |
| `…skills` | Skills | Demo skill list (hidden) |

Stock Chat view is deregistered; `chat.agent.enabled` stays false. Title-bar “Agents Window” is **WalkCroach Path B**, not Microsoft `vs/sessions`.

### Panel — `workbench.view.walkcroach.crdb`

Schema · Query · Audit · ccloud · Telemetry — panes are real; **data path is mostly demo fixtures** in `WalkCroachCrdbService` (see STATUS).

### Editors

| Editor | Command | Bundle |
|--------|---------|--------|
| WalkCroach Settings | `walkcroach.openSettings` | `settings-ui.js` |
| Agents Window | `walkcroach.openAgentsWindow` | `agent-ui.js` (`surface: 'agentsWindow'`) |

### Title bar

Settings gear · Chat/Agent toggle · Agents Window pill (`walkcroachTitleBar.contribution.ts`).

Default theme: **WalkCroach Graphite Lumen** (`extensions/theme-walkcroach/`).

---

## 6. Fleet and sessions (three kinds)

| Kind | Where | Durable? |
|------|-------|----------|
| AHP sessions/turns | `WalkCroachAgent` Maps in Agent Host | Process memory only |
| Fleet catalog (slots, URIs, titles) | Workbench storage via bridge | Yes (workspace/storage keys) |
| Bedrock transcript | `.walkcroach/sessions/` via `HostAdapter.persistAgentSession` | Yes on disk |
| UI chat messages | Agent service storage (fleet-aware) | Yes (UI snapshot) |

Soft parallel cap: **≤6** with explicit force (`common/fleet.ts`). Isolation is **prompt-seeded** `enter_worktree` (engine tool) + `DesktopHostAdapter.setToolRoot`, not host-side automatic worktree creation at launch.

---

## 7. Secrets and memory

| Concern | Mechanism |
|---------|-----------|
| UI tokens / project link | `ISecretStorageService` |
| Host-visible mirror | `userDataPath/walkcroach/secrets.json` (`FileSecrets` / `hostSecretsMirror`) |
| Online project memory | `/ide` when Cognito token + projectId present (`source_surface=desktop`) |
| Durable offline buffer | Classes exist under `.walkcroach/durable/` — **not product-wired** (see STATUS) |

Auth UX today: open Hosted UI / paste access token (PKCE not wired).

---

## 8. Product overlay

Source of truth: `product/product.walkcroach.json` → `npm run apply:product` → `vscode/product.json`.

Notable fields today:

- `quality`: **`insider`**
- Gallery: **Open VSX only** (Marketplace URLs refused)
- `updateUrl`: `https://updates.walkcroach.dev/desktop` (CDN may be undeployed)
- `downloadUrl`: GitHub Releases
- `enableTelemetry`: false
- `walkcroach.interimDistribution`: `windows-portable`
- Upstream pin fields: tag / commit / Electron / Node (see SHIPPING)

---

## 9. Locked product decisions (still in force)

1. **Native Agent Host**, not a fifth `runAgentLoop` host and not “extension-only” Desktop.
2. **Open VSX only** — never Microsoft Marketplace proxy.
3. **Path B Agents Window** — WalkCroach fleet on Agent Host; do not enable Microsoft Agents Window for WalkCroach.
4. **Unsigned Windows portable preview** until signing is funded.
5. Fork product code only under allowlisted paths; Agent Host provider is the intentional `platform/` exception.

---

## 10. Related packages outside this repo

| Package | Role |
|---------|------|
| `walkcroach/packages/agent-engine` | Tools, Bedrock loop, worktrees, MCP, skills |
| WalkCroach BFF `/ide` | Auth, projects, memory APIs |
| Chrome / IDE / CLI | Other hosts of the same engine |
