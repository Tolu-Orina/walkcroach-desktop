# Phase 0.2 — Open VSX / `product.json` gallery fields (VSCodium spike)

**Status:** LOCKED  
**Recorded:** 2026-07-18  
**Maps to:** FR-F01, FR-F12, NFR-F07  
**References:**
- VSCodium `prepare_vscode.sh` (commit `a6a4322e` and current `master`)
- Eclipse Open VSX adapter for VS Code gallery API

## How VSCodium applies branding

1. Clone / checkout pinned `microsoft/vscode`.
2. Copy/patch sources; **remove** Microsoft telemetry endpoints via `undo_telemetry.sh`.
3. Mutate `product.json` with `jq` helpers (`setpath` / `setpath_json`).
4. Deep-merge a local override `product.json` (extension API proposals, badge providers, etc.).
5. `npm ci` with Electron headers from `.npmrc` (`runtime=electron`, `target=<electron>`).

WalkCroach Desktop Phase A will follow the same mechanical pattern; custom code stays under `src/vs/workbench/contrib/walkcroach/`.

## Required `extensionsGallery` (Open VSX only)

Exact object VSCodium sets today (do **not** point at `marketplace.visualstudio.com`):

```json
{
  "serviceUrl": "https://open-vsx.org/vscode/gallery",
  "itemUrl": "https://open-vsx.org/vscode/item",
  "latestUrlTemplate": "https://open-vsx.org/vscode/gallery/{publisher}/{name}/latest",
  "controlUrl": "https://raw.githubusercontent.com/EclipseFdn/publish-extensions/refs/heads/master/extension-control/extensions.json"
}
```

### Field meanings

| Field | Purpose |
|-------|---------|
| `serviceUrl` | VS Code gallery query / download API base (Open VSX adapter) |
| `itemUrl` | Extension detail / marketplace item page base |
| `latestUrlTemplate` | Template for latest version metadata (`{publisher}`, `{name}`) |
| `controlUrl` | Malicious / blocked extension control list (EclipseFdn) |

### Optional / commonly present companion fields

| Field | VSCodium value / note |
|-------|----------------------|
| `linkProtectionTrustedDomains` | `["https://open-vsx.org"]` |
| `updateUrl` | Host for update manifests (WalkCroach: Phase E S3/CloudFront or GitHub raw) |
| `downloadUrl` | Human download page / releases |
| `extensionUrlTemplate` / `resourceUrlTemplate` | Used by some forks; **not** set in current VSCodium `prepare_vscode.sh` gallery blob — omit unless Open VSX docs require for our pin |

## WalkCroach Phase A identity keys (planned)

See `product/product.walkcroach.json` for the draft override used by the Phase 0 branded spike and Phase A merge.

| Key | Planned value |
|-----|----------------|
| `nameShort` | `WalkCroach` |
| `nameLong` | `WalkCroach Desktop` |
| `applicationName` | `walkcroach` |
| `dataFolderName` | `.walkcroach` |
| `urlProtocol` | `walkcroach` |
| `quality` | `stable` |
| `darwinBundleIdentifier` | `dev.walkcroach.desktop` |
| `win32MutexName` | `walkcroach` |
| `win32AppUserModelId` | `WalkCroach.Desktop` |
| `extensionsGallery` | Open VSX object above |
| Telemetry endpoints | **omitted / disabled** (NFR-F06 / FR-F04) |

## Absolute prohibitions (NFR-F07)

- Do **not** set `extensionsGallery.serviceUrl` (or any gallery URL) to Microsoft Marketplace.
- Do **not** implement a reverse-proxy or “compatibility shim” to `marketplace.visualstudio.com`.
- Do **not** inherit VS Code’s built-in extension recommendation list without Open VSX existence + verified-publisher audit (NFR-F09; Phase A ships empty curated list).

## Verification performed (Phase 0)

- Confirmed default OSS `product.json` at pin has **no** `extensionsGallery` — gallery must be added explicitly.
- Confirmed VSCodium Open VSX URLs via `prepare_vscode.sh`.
- Confirmed EclipseFdn `controlUrl` host responds (JSON control list).
