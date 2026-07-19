# Phase B — Engine bridge (electron-main ↔ workbench)

**Decision locked:** Bedrock + `@walkcroach/agent-engine` + `DesktopHostAdapter` run in **Node** (`@walkcroach/desktop-agent`). The workbench renderer owns chat UI, approvals, and `/ide` browser fetch — never AWS credentials in the renderer.

## Layout

```text
packages/desktop-agent/          # Node HostAdapter + runAgentLoop + /ide memory (source_surface=desktop)
vscode/.../contrib/walkcroach/
  common/engineBridge.ts         # IPC channel + event types
  browser/walkcroachAgentService.ts  # UI service (local structured turn until bridge wired)
  browser/chat|approval|diff|…   # Native UX
```

## Channel

- Name: `walkcroach.engine` (`WALK_CROACH_ENGINE_CHANNEL`)
- Main process: load `@walkcroach/desktop-agent`, call `startDesktopSession`, forward coalesced `AgentEvent`s
- Renderer: `IWalkCroachAgentService` maps events → transcript / QuickPick / cache status bar

## Phase B shipping bar (without full Electron compile)

| Path | Behavior |
|------|----------|
| Unlinked / no bridge | Local structured turn + trust gate + approval QuickPick + simulated stream + cache metrics |
| Linked | Same + `/ide` recall (`sourceSurfaces` includes `desktop`) |
| Bridge enabled (later) | Real `runAgentLoop` via desktop-agent; approvals resolve over IPC |

## Cognito (PB.6)

- **Phase B:** Hosted UI open (`walkcroach.desktop.cognitoHostedUiUrl`) + **Paste Access Token** into SecretStorage
- **Next:** PKCE in electron-main; store tokens in SecretStorage; never log tokens

## Memory surface

Always mirror with `sourceSurface: "desktop"`. BFF `/ide/v1/memory/mirror` accepts `ide` | `desktop`.
