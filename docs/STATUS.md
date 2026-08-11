# WalkCroach Desktop — Status

**As of:** 2026-08-08 · **Source:** codebase review + live CRDB/MCP restore  
**Architecture:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) · **Ship:** [`SHIPPING.md`](./SHIPPING.md)

Honest inventory of what runs, what is stubbed, and what is deferred. **Product maturity matches other WalkCroach surfaces**; distribution is **unsigned preview** until signing/notarization lands.

---

## 1. Verdict

| Claim | Reality |
|-------|---------|
| Native agent path (UI → AHP → engine) | **Works** in-repo |
| Fleet Agents Window (Path B) | **Works** (soft cap, tabs/grid, multi-slot) |
| Memory across surfaces | **Live** when linked — `/v1/memory/*`; durable buffer on mirror failure |
| CockroachDB panels | **Live** via Agent Host `CrdbPanelSession` (`demoMode: false`) + Managed MCP / ccloud; unconfigured = empty/error + Configure |
| Auth | **Web `/connect/ide` PKCE** (IDE parity); paste-token emergency fallback; no Cognito Hosted UI in Settings |
| Public distribution | **Unsigned preview channel** — Windows portable/Setup; signing deferred |
| Product maturity | **Production-grade** — same bar as IDE / CLI / other surfaces; not dogfood |

---

## 2. Implemented (code-backed)

### Agent Host + engine

- `WalkCroachAgent` registered first in `agentHostMain.ts` (id `walkcroach`, Nova Pro catalog).
- Session CRUD (in-memory), chat send/abort, streaming markdown parts/deltas.
- Mode codec `__WC_MODE__` → engine `plan` / `full`.
- Approvals via AHP `ChatInputRequested` + `resolveApproval` / questions.
- Workbench prefer-read/write (agent-client URI) + search RPC (`wc-rpc:search`) + **CRDB RPC** (`__WC_CRDB_RPC__` / `wc-rpc:crdb`).
- Loads `@walkcroach/desktop-agent` from monorepo `dist/` or **`engine-bundle.cjs`** (~2 MiB CJS).
- `DesktopHostAdapter`: trust gate, path escape, fs/glob/search/terminal spawn, autonomy, disk session persist/load, `setToolRoot` for worktrees.
- IDE client: health/me/projects/link + `ProjectMemoryBridge` with `source_surface=desktop`.
- **Live CRDB:** `getOrCreateCrdbPanel` singleton; confirms via `wc-crdb-confirm:`; secrets mirrored (`mcpUrl` / `mcpApiKey` / `ccloudApiKey` / …).

### UI

- Agent aux webview + Agents Window editor (same `agent-ui.js`, protocol v4 / fleet).
- Settings editor (`settings-ui.js`): Web Connect PKCE + paste fallback; **Configure CockroachDB** on Memory tab; no Hosted UI fields.
- Title-bar triad: Settings · Agent toggle · Agents Window.
- Memory pane: live recall/mirror when token+project linked.
- CRDB panels: Schema / Query / Audit / ccloud / Telemetry — live when configured.
- Import / Incompatibles: migration scan + proprietary catalog from product embed.
- Theme: Graphite Lumen; stock Chat suppressed; branding icons swapped on allowlisted resources.

### Fleet / sessions

- Multi-slot bridge, fleet catalog persistence, soft cap **6** + force.
- Isolation preamble nudges engine `enter_worktree`; adapter scopes tool root.
- UI transcript rehydrate + AHP URI reattach across window close; disk Bedrock sessions across app restart.

### Product / supply chain scaffolding

- Open VSX gallery overlay; telemetry off; surface-area audit; recommendation audits.
- Crash Lambda TF + opt-in client contribution; update S3 TF (no CloudFront resources yet).
- Windows portable package scripts: bundle → gulp → inject media → zip → `SHA512SUMS` → `gh release`.

### Tests (desktop-agent)

Vitest suites covering adapter path escape/trust, durable store unit behavior, CRDB panel session gates, D5 session/worktree, fleet-cap **logic copy**, provenance **logic copy**.

---

## 3. Incomplete / stubbed / deferred

| Area | Evidence |
|------|----------|
| Chat fork | `WalkCroachAgent`: throws “forking a chat is not supported yet” |
| `changeModel` / `changeAgent` | No-ops on provider |
| Client-resume tools | Empty `onClientToolCallComplete` body |
| Cognito Hosted UI in product | **Removed** — Web PKCE only in Settings |
| `preferRunTerminal` | Typed on engine runtime; **never passed** from `WalkCroachAgent` (terminal = Node spawn fallback) |
| Skills aux view | Hardcoded `DEMO_SKILLS` |
| Agent-ui | **No unit tests** |
| Auto-update | `updateUrl` set; CDN/CloudFront incomplete |
| Crash endpoint in product | `crashEndpoint: ""` |
| Signed release / notarization | **Explicitly deferred** |
| Full Windows zip in CI | Not run — nested `vscode/` absent from parent git |

---

## 4. Bugs and risks (from code)

1. ~~**Double `onEvent` risk**~~ — **Fixed (P0)**
2. ~~**Approval fan-out**~~ — **Fixed (P0)**
3. **`respondToPermissionRequest` vs `wc-approve:` prefix** — permission API now parses via `parseApprovalRequestId` when possible.
4. ~~**Plaintext secrets.json**~~ — **Fixed (P1)**
5. **AHP session state not durable** — Agent Host Maps die with the process.
6. **Search-over-ChatInput** — functional via workbench proxy; fragile protocol smell.
7. **Protocol drift** — guarded by `scripts/sync-agent-protocol.mjs`.
8. ~~**Dead native chat**~~ — **Fixed (P2)**
9. ~~**Settings reopen ignores tab**~~ — **Fixed (P0)**
10. **Upstream sync CI clones `1.129.0`** while product pin is **`1.131.0`**.
11. **Fleet soft-cap / provenance tests** duplicate production functions — can drift.
12. ~~**Aux bar dual headers**~~ — **Fixed (P1)**
13. ~~**Demo CRDB panes / P3 deregister**~~ — **Superseded:** live MCP + ccloud via Host RPC; fail closed when unconfigured.

---

## 5. Capability matrix

| Capability | State |
|------------|-------|
| Chat / Plan / Agent turns via Bedrock | ✅ when Bedrock key present |
| Approvals / ask-user | ✅ |
| Fleet tabs/grid ≤6 + force | ✅ |
| Worktree isolation (engine tools) | ✅ when model invokes tools |
| Window-close / restart survival (UI + disk session) | ✅ (AHP Maps are not durable) |
| Project memory online | ✅ when linked |
| Durable offline memory buffer | ✅ wired |
| Live CockroachDB MCP in panels | ✅ when configured (`walkcroach.crdb.configure`) |
| Live ccloud | ✅ when `ccloud` API key configured; hard confirm |
| Auth (Web PKCE) | ✅ `/connect/ide` + `walkcroach://` callback |
| Open VSX recommendations | ✅ audits |
| Unsigned Windows portable tooling | ✅ (`--enforce-size` optional gate) |
| Published unsigned Release | ⏳ operator |
| Code signing / notarization | ❌ deferred |
| macOS / Linux public packaging | ❌ out of scope this pass |

---

## 6. Deep-review backlog (remaining)

1. Wire `preferRunTerminal` or document Node-only terminal forever.
2. Import shared fleet/provenance helpers in tests; add agent-ui smoke tests.
3. Align upstream-sync CI pin with `product.walkcroach.json`.
4. Publish first `desktop-v*` unsigned Release.
5. Deploy IDE BFF + Web with `walkcroach://` redirect allowlist so Desktop PKCE works against production.
6. Code signing / SmartScreen / notarization when budget allows.
