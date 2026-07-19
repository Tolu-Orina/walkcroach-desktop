# Phase 0.7 — Legal pass (MIT source vs Microsoft product)

**Status:** PASS (design constraints locked)  
**Recorded:** 2026-07-18  
**Maps to:** NFR-F07, FR-F01, FR-F12

## Facts

1. **`microsoft/vscode` source** is MIT-licensed. Building from source with a custom `product.json` yields an MIT-licensed binary (VSCodium / Code - OSS model). Microsoft maintainers have stated publicly that cloning the repo and laying down your own `product.json` produces a clean build without Microsoft branding/telemetry endpoints.
2. **“Visual Studio Code”** as distributed by Microsoft is a separate product build with Microsoft’s proprietary `product.json` (telemetry, gallery, branding) under Microsoft’s product license — **not** what WalkCroach ships.
3. **Visual Studio Marketplace Terms of Use** restrict Marketplace offerings to Microsoft in-scope products (VS, VS Code, Codespaces, Azure DevOps, etc.) and **prohibit use with alternative products built on a fork**.
4. **Historical enforcement (2025):** Microsoft proprietary extensions (e.g. C/C++ tooling, Pylance, Remote Development family) stopped working / were blocked in unofficial forks; reverse-proxy approaches are not a durable strategy.
5. **WalkCroach LICENSE** (product monorepo): MIT, Copyright (c) 2026 Tolulope Orina — compatible with embedding MIT vscode source and MIT agent-engine code, subject to retaining notices.

## Binding design decisions (confirmed)

| Topic | Decision |
|-------|----------|
| Source base | MIT `microsoft/vscode` at pinned commit only |
| Branding | WalkCroach `product.json` — no Microsoft trademarks as product name |
| Extension registry | **Open VSX only** |
| Microsoft Marketplace | **No access, no proxy, no shim** (NFR-F07) |
| Proprietary MS extensions | Disclose incompatibility; suggest open alternatives; do not redistribute MS VSIX against ToS |
| Telemetry | Off by default; any opt-in documented (FR-F04) |
| Recommendations | Curated + Open VSX-verified only (NFR-F09) — never inherit unaudited VS Code list |

## Residual risks (accepted)

- Open VSX catalog ≠ Marketplace catalog (feature gap, not a legal workaround).
- Trademark: avoid “VS Code” / “Visual Studio Code” in product name; “compatible with VS Code extensions via Open VSX” is descriptive use — legal counsel review before marketing launch (Phase E+).

## Conclusion

Phase 0 legal pass: **proceed** with fork-from-MIT-source + Open VSX-only architecture. Marketplace proxy is explicitly out of scope forever.
