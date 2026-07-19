# Phase 0.1 — Upstream pin (`microsoft/vscode`)

**Status:** LOCKED for Phase A bootstrap  
**Recorded:** 2026-07-18  
**Maps to:** FR-F01

## Pin

| Field | Value |
|-------|--------|
| Tag | `1.129.0` (latest stable as of 2026-07-15) |
| Commit SHA | `125df4672b8a6a34975303c6b0baa124e560a4f7` |
| Release branch | `release/1.129` |
| Release URL | https://github.com/microsoft/vscode/releases/tag/1.129.0 |
| Source license | **MIT** (`package.json` `"license": "MIT"`) |
| Default OSS product name | Code - OSS (`product.json`) |

## Runtime / toolchain (from pinned commit)

| Component | Source | Version |
|-----------|--------|---------|
| Electron | `.npmrc` `target=` | **42.6.0** |
| Electron build id | `.npmrc` `ms_build_id=` | `14623276` |
| Node (build / `.nvmrc`) | `.nvmrc` | **24.18.0** |
| Node (remote server `.npmrc`) | `remote/.npmrc` `target=` | **24.18.0** |
| Host Node for this Phase 0 spike machine | local | `v22.16.0` (spike only; Phase A compile must use 24.18.0) |

## Default OSS `product.json` identity (pre-rebrand)

Captured from `https://raw.githubusercontent.com/microsoft/vscode/125df4672b8a6a34975303c6b0baa124e560a4f7/product.json`:

| Key | Value |
|-----|--------|
| `nameShort` | `Code - OSS` |
| `nameLong` | `Code - OSS` |
| `applicationName` | `code-oss` |
| `dataFolderName` | `.vscode-oss` |
| `urlProtocol` | `code-oss` |
| `darwinBundleIdentifier` | `com.visualstudio.code.oss` |
| `win32MutexName` | `vscodeoss` |
| `extensionsGallery` | **absent** (must be set for Open VSX — see `OPEN_VSX_GALLERY.md`) |
| `updateUrl` | **absent** (set in Phase A / E) |

## Clone command (Phase A — do not run full compile in Phase 0)

```bash
git clone --branch 1.129.0 --depth 1 https://github.com/microsoft/vscode.git vscode
cd vscode
git remote add upstream https://github.com/microsoft/vscode.git
git fetch upstream tag 1.129.0
git checkout 125df4672b8a6a34975303c6b0baa124e560a4f7
```

## Decision

Phase A bootstraps the full fork from this exact commit. Do not float to `main` until the first scheduled upstream sync (NFR-F12).
