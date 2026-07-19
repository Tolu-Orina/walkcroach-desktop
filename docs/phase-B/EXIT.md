# Phase B — Exit criteria record

**Date:** 2026-07-19  
**Plan:** `walkcroach/docs/walkcroach-desktop-ide-implementation-plan.md` § Phase B

## Task matrix

| ID | Task | Artifact | Status |
|----|------|----------|--------|
| PB.1 | `DesktopHostAdapter` (fs/terminal/trust/secrets) | `packages/desktop-agent/src/desktopHostAdapter.ts` | ✅ |
| PB.2 | Agent loop + coalesced events → native chat | `session.ts` + `WalkCroachChatViewPane` (+ ENGINE_BRIDGE for Bedrock) | ✅ Structural |
| PB.3 | Diff/command approval UI | `WalkCroachApprovalController` (QuickPick) | ✅ |
| PB.4 | Terminal overlay entry | `walkcroach.terminal.ask` | ✅ |
| PB.5 | First-run onboarding shell | `walkcroach.onboarding` | ✅ |
| PB.6 | Cognito + SecretStorage + `/ide` | Paste token + Hosted UI open; `ideApi.ts` / `ideClient.ts` | ✅ Stub PKCE documented |
| PB.7 | Link + `source_surface=desktop` | Link actions + BFF mirror accepts `desktop` | ✅ |
| PB.8 | Diff inline commentary stub | `WalkCroachDiffCommentaryContribution` | ✅ |
| PB.9 | Autonomy + hard gates + tests | dial + `desktopHostAdapter.test.ts` engine parity | ✅ |
| PB.10 | Cache metrics visible | chat meta + status bar; coalescer in desktop-agent | ✅ |

## Exit criteria

| Criterion | Result |
|-----------|--------|
| Unlinked local agent UX without account | ✅ workbench structured turn |
| Approvals native (not extension webview) | ✅ QuickPick |
| Linked recall path against `/ide` | ✅ when token + project linked |
| `source_surface=desktop` locked | ✅ clients + BFF mirror |
| Full “add a health route” on Bedrock in Desktop | ⏳ Requires electron-main bridge + compile (disk-gated) |
| First-token ≤2.5s p50 measured | ⏳ Deferred to bridge + reference hardware |

## Verify

```bash
npm run phaseB:verify
```
