## Verdict

Desktop is a **production-grade agentic IDE** at maturity parity with other WalkCroach surfaces. The loop runs: webview → Agent Host → `@walkcroach/desktop-agent` → `@walkcroach/agent-engine` `runAgentLoop`, with **project memory on `@walkcroach/sdk`** and **live CRDB panels** via Host `CrdbPanelSession` + Managed MCP. Shipping caveats only: **unsigned** and **preview channel** — not dogfood, not a soft product.

**Assumptions this review is built on:** production-grade quality bar (parity with IDE/CLI); preview/unsigned distribution; keep Path B + Agent Host; do not reopen Marketplace proxy; ranked QAs = trust/approval correctness → cross-surface memory truth → live MCP honesty → UX clarity → package size → upstream merge tax.

---

## Runtime map (verified)

```text
agent-ui / settings-ui (React webview)
  → WalkCroachAgentService + AgentBridge (workbench)
  → WalkCroachAgent (AHP / Agent Host)
  → desktop-agent (dist or engine-bundle.cjs ~2.1 MiB)
  → agent-engine runAgentLoop  +  SDK createHostMemoryBridge → /v1/memory/*
```

| Layer | Role today | Epistemic |
|---|---|---|
| `@walkcroach/agent-engine` | Coding loop, tools, compaction, local semantic index, approvals | **Verified** |
| `@walkcroach/sdk` | Host memory bridge only (`createHostMemoryBridge`) | **Verified** in `desktop-agent/src/ideClient.ts` |
| `@walkcroach/desktop-agent` | `DesktopHostAdapter` + session runner | **Verified** |
| Renderer `WalkCroachIdeApi` | Still bespoke `/ide/v1/memory/*` for UI recall/mirror | **Verified** — dual memory clients |
| Public SDK as “the agent” | Not used; correctly so | **Verified** |

**Best path (commit to this):** keep **agent-engine** as the Desktop/IDE/CLI brain; use **SDK only for memory/content/keys**; converge renderer memory onto the same SDK contract (or a thin isomorphic client). Do **not** route Desktop through `agent-harness`, and do **not** publish the engine as “the SDK.”

---

## 1. Toolbar — duplicate settings gear

**Cause (verified):** WalkCroach contributes `Codicon.settingsGear` → `walkcroach.openSettings` on `MenuId.TitleBar`. With `workbench.activityBar.location: 'top'`, the stock **Manage** control (`GlobalActivity`) also lands in the title-bar cluster — another gear-shaped control that opens the VS Code Manage menu (including stock Settings). WalkCroach Settings is *also* in `GlobalActivity` / Preferences menu.

**Recommendation:** keep **one** visible gear: WalkCroach Settings.
- Keep title-bar `walkcroach.openSettings`.
- From Manage menu: keep stock Settings as **“VS Code Settings”** (already mirrored as an external nav item in settings-ui).
- Hide or de-emphasize Manage as a second gear in the title cluster (contrib/CSS or stop rendering `SimpleGlobalActivityActionViewItem` beside WC), **or** make Manage’s primary entry open WalkCroach Settings and demote stock Settings — but then you still have two gears if WC TitleBar gear stays. Prefer **remove visual duplicate**, not two entry points with the same icon.

Also fix: settings reopen ignores tab (STATUS #9).

---

## 2. Left sidebar / activity chrome

**Verified intent:** `activityBar.location: 'top'` is deliberate Cursor-like horizontal strip — lowest-rung, no core patch.

**Problems:**
- Aux container has `mergeViewWithContainerWhenSingleView: false` so **Agent + Memory** show dual headers (STATUS #12) — fights the “one WalkCroach header” comment in the same file.
- Skills / Import / Incompatibles hidden by default — good.
- Bottom **CRDB** panel container is live product UI (Managed MCP / ccloud via Host RPC); unconfigured = empty + Configure — never silent fixtures.

**Recommendation:**
- Primary left sidebar stays Explorer/SCM/Search (editor IDE, not agent-first like Cursor’s forced Agent layout — Cursor users are actively angry about Agent/Editor thrash; Windsurf’s Cascade-in-sidebar is the cleaner reference).
- Aux (right): **Agent primary**; Memory as a tab/segment inside the same pane or overflow — not a second always-on view fighting the header.
- Keep CRDB panes honest: live when configured; fail closed otherwise.

---

## 3. Agent chat (right)

**Works (verified, needs Bedrock key + trusted workspace):** Chat / Plan / Agent modes → AHP → engine; streaming; approvals; fleet soft-cap 6; session rehydrate.

**UX debt:**
- Orb background + palette picker + fleet chrome + status line compete in a narrow aux column (dense IDE anti-pattern vs Windsurf Cascade restraint).
- Dead native `WalkCroachChatViewPane` / unused approve command IDs — delete or quarantine.
- Protocol hand-mirror `agent-ui` ↔ `walkcroachAgentProtocol.ts` — drift risk.
- Diff preview only logged; `setDiffCommentary` has no callers.
- Model list in UI is display stubs until host exposes catalog.

**Recommendation:** quiet the aux to **mode + transcript + composer + approval cards**; move fleet chrome to Agents Window; generate protocol types once.

---

## 4. WalkCroach Settings UI

**Exists and is closer to brand than stock VS Code** — Graphite Lumen tokens, signal/teal/ember roles, glass nav, motion tab change (`packages/agent-ui/src/settings/*`).

**Design gaps vs your frontend skills:**
- Too many **cards** for static copy (“Modes”, “Project link”) — cards should be for interaction, not decoration.
- Serif display title fights IDE density; keep brand mark, use one UI sans scale.
- Auth is **Web `/connect/ide` PKCE** (IDE parity) + paste-token emergency fallback; Cognito Hosted UI removed from Settings.
- Memory tab: link project + **Configure CockroachDB**; durable buffer wired on mirror failure.
- No `agent-ui` unit/smoke tests.

**Recommendation:** keep Settings as the **product control plane** (account PKCE, autonomy, project link, CRDB configure, update channel); leave editor prefs to “VS Code Settings ↗”.

---

## 5–6. Functionality matrix (honest)

| Capability | State | Notes |
|---|---|---|
| Agentic loop | **Yes** | `runAgentLoop` via `startEngineTurn` |
| Tool calls | **Yes** | HostAdapter fs/glob/search/terminal(+spawn fallback)/approvals |
| Round-trip (UI ↔ engine ↔ UI) | **Yes** | AHP stream + approval resolve; known **fleet approval fan-out** bug |
| Local vectorization | **Yes (engine)** | `semantic_search` → Titan embed → `.walkcroach/index` |
| Cloud memory / CRDB | **Partial** | Online when Cognito + project linked via **SDK** in host; UI recall still `/ide/v1` |
| Memory compaction | **Yes (engine)** | Extractive compact at threshold ~36 / keep ~16 |
| Durable offline buffer | **Yes** | Buffer on mirror failure; flush on link/turn |
| CRDB Schema/Query/ccloud panes | **Live when configured** | Host `CrdbPanelSession` + MCP/ccloud; fail closed |
| `preferRunTerminal` | **Unwired** | Node spawn fallback |
| Secrets encryption | **safeStorage** when available | plaintext migration fallback |

So: the sidebar is **truthful for the coding agent and CRDB console** when credentials are configured.

---

## 7. Package size — barest minimum

**Hard constraint:** Code OSS + Electron ≈ stock VS Code installer (~**220 MB** class). Cursor/Windsurf land **~580–720 MB** installed. You will not beat Zed/Tauri (~100 MB) without leaving Electron — **reject Tauri rewrite for now** (HostAdapter, AHP, Open VSX, merge tax).

**Realistic target:** **stock Code OSS zip/Setup size + &lt;10 MB WalkCroach overlay.**

| Lever | Impact |
|---|---|
| Ship Setup.exe only (`--skip-zip`); `clean:package` | Disk/CI, not user download if zip optional |
| One `engine-bundle.cjs` (~2.1 MiB); no duplicate monorepo `dist` in package | Small but real |
| Trim `agent-ui` / `settings-ui` (523 KB + 348 KB today) — drop unused lucide/radix if possible | Marginal |
| Locales / unused built-in extensions / no source maps / ASAR (upstream restoring asar) | Largest Code OSS levers |
| Do not vendor extra Chromium/indexing stacks “like Cursor” | Avoids 700 MB class |

“Barest minimum” while staying an IDE = **match VS Code, not chase 50 MB.**

---

## 8. Overall UI/UX direction

Compete on what competitors can’t copy quickly:
1. **Cross-surface memory demo in 30s** (linked project recall chips that are real).
2. **Approval discipline** (fix fan-out; session-scoped).
3. **Quiet editor-first chrome** — avoid Cursor’s Agent-layout thrash; prefer Windsurf-like persistent right agent.

Visual system: keep Graphite Lumen + signal/teal/ember exclusivity; kill decorative orbs in narrow aux; one radius/shadow; Settings as glass product surface; workbench chrome stays `--vscode-*`.

---

## Priority roadmap (recommended sequence)

| P | Work | Why |
|---|---|---|
| P0 | Single settings gear + fix settings tab reopen | **Done** — TitleBar Manage gear hidden; Settings `applyTab` |
| P0 | Session-scoped approvals (kill fleet fan-out) + double-emit | **Done** — ownership map + single onEvent path |
| P1 | Aux IA: one WalkCroach header; Memory nested; CRDB labeled/hidden | **Done** — merge+hide Memory; Demo · CRDB |
| P1 | Wire or delete durable buffer; encrypt FileSecrets | **Done** — buffer on mirror fail; safeStorage encrypt |
| P1 | Renderer memory → SDK contract | **Done** — `/v1/memory/*` in `ideApi.ts` |
| P2 | Settings redesign + PKCE | **Done** — Connect/paste states; `/connect/ide` PKCE + `walkcroach://` callback |
| P2 | Quiet agent-ui; protocol codegen; delete dead native chat | **Done** — aux quiet; sync script; dead chat deleted |
| P2 | Diff review wired end-to-end | **Done** — Open Diff + commentary + `walkcroach-diff` |
| P3 | Package trim pass + size budget in CI | **Done** — `--skip-zip` + `--enforce-size` (235 MiB default) |
| P3 | Live CRDB MCP **or** remove panes | **Superseded** — live Managed MCP + ccloud via Host RPC (`demoMode: false`); P3 deregister reversed |
| P3 | Strip Cognito Hosted UI; Web PKCE only | **Done** — Settings Connect + paste; no Hosted UI fields |

**Dominant trade-off:** live CRDB requires Agent Host RPC (Workbench cannot spawn MCP/`ccloud`). Re-shipping demo panes was rejected.

**Rejected alternatives:**
- Extension-only Desktop — loses Agent Host / Path B investment.
- Collapse to public SDK-as-loop — wrong product boundary.
- Tauri/Sidex rewrite for size — destroys AHP/extension economics now.
- Copy Cursor Agent/Editor layouts — documented UX failure mode.

**Fitness / revisit:** reopen packaging strategy if Setup.exe exceeds stock VS Code +15%; reopen Path B if upstream `vs/sessions` becomes the only supported AHP UX; reopen durable memory design if offline-first becomes a sales requirement.

---

## Decision / Ask

1. Confirm **P0 = gear dedupe + approval scoping** as the next coding spike (I can implement immediately).
2. Confirm Settings redesign is **in-webview** (current approach) vs native ViewPane — recommend stay webview.
3. For durable memory: **wire buffer writes into mirror path**, or **strip claims from Settings/Memory UI** until wired — which do you want?
