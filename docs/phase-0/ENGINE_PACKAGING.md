# Phase 0.5 — Engine packaging decision + import proof

**Status:** DECIDED + PROVEN  
**Recorded:** 2026-07-18  
**Maps to:** Engine purity constraint; Implementation Plan §3.1 / §4

## Decision (A1)

| Option | Choice |
|--------|--------|
| **Selected** | **Git / path dependency** on monorepo `@walkcroach/agent-engine` for Phase 0–B local development |
| Phase A+ packaging | Prefer publishing `@walkcroach/agent-engine` from the product monorepo to a private npm registry (or GitHub Packages) when Electron packaging needs a clean semver; until then, `file:` / workspace link is acceptable |
| Rejected for now | Vendoring a copy of the engine into the fork (creates dual-source drift) |

### Rationale

1. Engine already exists, is vscode-free, and powers `ide/` + `cli/`.
2. Path/git dependency proves Desktop can import without rewriting the loop (Cline lesson).
3. Private npm publish is additive later for CI release builds — not a Phase 0 blocker.

## Purity rule

`@walkcroach/agent-engine` must never import `vscode`. Phase 0 verified: **no** `from 'vscode'` / `require('vscode')` matches under `packages/agent-engine/src`.

## Proof artifact

```text
spike/engine-import/
```

Run:

```bash
# From product monorepo
cd ../walkcroach/packages/agent-engine && npm run build

# From walkcroach-desktop
cd spike/engine-import && npm install && npm test
```

Expected: tests pass; imports resolve `HostAdapter` types, `runAgentLoop`, `createFakeHost`, and assert `package.json` name is `@walkcroach/agent-engine`.
