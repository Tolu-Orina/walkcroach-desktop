# WalkCroach Desktop — Status

**As of:** 2026-08-07 · **Source:** codebase review (not historical phase docs)  
**Architecture:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) · **Ship:** [`SHIPPING.md`](./SHIPPING.md)

Honest inventory of what runs, what is demo/stubbed, and what is risky.

---

## 1. Verdict

| Claim | Reality |
|-------|---------|
| Native agent path (UI → AHP → engine) | **Works** in-repo |
| Fleet Agents Window (Path B) | **Works** (soft cap, tabs/grid, multi-slot) |
| Memory across surfaces | **Partial** — online `/ide` when linked; durable buffer unused |
| CockroachDB panels | **UI only** — demo fixtures; not live cluster MCP |
| Public distribution | **Tooling ready**; first GitHub Release is operator step; unsigned |
| “Desktop IDE done” | **Feature-complete for preview dogfood**, not production-hardened |

---

## 2. Implemented (code-backed)

### Agent Host + engine

- `WalkCroachAgent` registered first in `agentHostMain.ts` (id `walkcroach`, Nova Pro catalog).
- Session CRUD (in-memory), chat send/abort, streaming markdown parts/deltas.
- Mode codec `__WC_MODE__` → engine `plan` / `full`.
- Approvals via AHP `ChatInputRequested` + `resolveApproval` / questions.
- Workbench prefer-read/write (agent-client URI) + search RPC (`wc-rpc:search`).
- Loads `@walkcroach/desktop-agent` from monorepo `dist/` or **`engine-bundle.cjs`** (~2 MiB CJS).
- `DesktopHostAdapter`: trust gate, path escape, fs/glob/search/terminal spawn, autonomy, disk session persist/load, `setToolRoot` for worktrees.
- IDE client: health/me/projects/link + `ProjectMemoryBridge` with `source_surface=desktop`.

### UI

- Agent aux webview + Agents Window editor (same `agent-ui.js`, protocol v2 / fleet).
- Settings editor (`settings-ui.js`) for WalkCroach config / auth snapshot.
- Title-bar triad: Settings · Agent toggle · Agents Window.
- Memory pane: live recall/mirror when token+project linked; demo fallback otherwise.
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

Vitest suites covering adapter path escape/trust, durable store unit behavior, CRDB panel session gates, D5 session/worktree, fleet-cap **logic copy**, provenance **logic copy**. **24 tests** observed green in recent runs.

---

## 3. Incomplete / stubbed / demo

| Area | Evidence |
|------|----------|
| Chat fork | `WalkCroachAgent`: throws “forking a chat is not supported yet” |
| `changeModel` / `changeAgent` | No-ops on provider |
| Client-resume tools | Empty `onClientToolCallComplete` body |
| Cognito via AHP protected resources | Disabled — returns empty / authenticate false (paste-token path instead) |
| `preferRunTerminal` | Typed on engine runtime; **never passed** from `WalkCroachAgent` (terminal = Node spawn fallback) |
| Diff preview | Logged only; no UI; `setDiffCommentary` has **no callers** |
| DurableMemoryStore in Agent Host | Constructed then `void store` — dead |
| Durable `bufferWrite` / `bufferDecision` | Not called from product code (tests only) |
| FileSecrets encryption | Optional hooks exist; production wire-up is **plaintext JSON** |
| CRDB Schema / Query / ccloud | Demo fixtures; “ccloud runner not wired” |
| Skills aux view | Hardcoded `DEMO_SKILLS` |
| Workbench CRDB service | Does not import `CrdbPanelSession` from desktop-agent |
| Agent-ui | **No unit tests** |
| PKCE / real Cognito Hosted UI completion | Paste token |
| Auto-update | `updateUrl` set; CDN/CloudFront incomplete; interim does not claim updates |
| Crash endpoint in product | `crashEndpoint: ""` |
| Signed release CI | `if: false` |
| Full Windows zip in CI | Not run — nested `vscode/` absent from parent git |

---

## 4. Bugs and risks (from code)

1. **Double `onEvent` risk** — same callback passed into `createSessionHost` and `startDesktopSession`; session wrapper may re-emit (`packages/desktop-agent/src/session.ts` + engine runtime).
2. **Approval fan-out** — resolve iterates **all** `_engineSessions`; parallel fleet turns can cross-resolve.
3. **`respondToPermissionRequest` vs `wc-approve:` prefix** — permission API may not strip the same prefix as `handleUserInput`.
4. **Plaintext secrets.json** — access tokens / Bedrock keys on disk without safeStorage encrypt.
5. **AHP session state not durable** — only URIs + UI/disk Bedrock transcripts; Agent Host Maps die with the process.
6. **Search-over-ChatInput** — functional via workbench proxy; fragile protocol smell.
7. **Protocol drift** — `agent-ui/src/protocol.ts` hand-mirrored to `walkcroachAgentProtocol.ts`.
8. **Dead code** — native `WalkCroachChatViewPane` / agent components unused; approve/reject **command IDs** exported but never `registerAction2`.
9. **Settings reopen ignores tab** — if Settings already open, tab argument not applied.
10. **Upstream sync CI clones `1.129.0`** while product pin is **`1.131.0`** (workflow skew).
11. **Fleet soft-cap / provenance tests** duplicate production functions instead of importing them — can drift silently.
12. **Aux bar** shows Agent + Memory by default with `mergeViewWithContainerWhenSingleView: false` — dual headers (comments elsewhere imply a single merged WalkCroach header).

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
| Durable offline memory buffer | ❌ unwired |
| Live CockroachDB MCP in panels | ❌ demo |
| Live ccloud | ❌ |
| Open VSX recommendations | ✅ audits |
| Unsigned Windows portable tooling | ✅ |
| Published preview Release | ⏳ operator |
| Code signing / notarization | ❌ no budget path |
| macOS / Linux public preview | ❌ not marketed |

---

## 6. Deep-review backlog (suggested)

Priority order for a hardening pass (not claiming these are scheduled):

1. Wire or remove DurableMemoryStore / buffer path; encrypt FileSecrets with Electron safeStorage.
2. Fix double-emit + multi-session approval scoping.
3. Wire `preferRunTerminal` or document Node-only terminal forever.
4. Either connect CRDB panes to engine MCP or label UI “demo” in-product.
5. Delete or quarantine dead native chat pane / unused command IDs.
6. Import shared fleet/provenance helpers in tests; add agent-ui smoke tests.
7. Align upstream-sync CI pin with `product.walkcroach.json`.
8. Publish first `desktop-v*` unsigned Release and dogfood PREVIEW path in SHIPPING.
