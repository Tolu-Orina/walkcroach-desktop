# No Microsoft Marketplace proxy — forever (NFR-F07 / FR-F12)

**Status:** BINDING — do not reopen without a written ADR that explicitly accepts ToS / enforcement risk (we will not).  
**Phase:** D (PD.1)  
**Date:** 2026-07-19

## Decision

WalkCroach Desktop uses **Open VSX only** as its extension registry.

| Allowed | Forbidden |
|---------|-----------|
| `https://open-vsx.org/vscode/gallery` (and Open VSX item/latest/control URLs) | `marketplace.visualstudio.com` in any `product.json` / gallery field |
| Installing extensions that **exist** on Open VSX | Reverse-proxy, CDN mirror, or “compatibility shim” to Microsoft Marketplace |
| Documenting proprietary gaps + open alternatives | Shipping inherited VS Code recommendation tips without Open VSX audit |

## Why (dated lessons)

1. **April 2025 — Cursor enforcement:** Microsoft cut proprietary extensions after Marketplace reverse-proxying. NFR-F07 exists so we never repeat that.
2. **January 2026 — Open VSX namesquatting (Koi):** Inherited recommendation lists pointed at IDs missing on Open VSX. NFR-F09 / PD.2–PD.7 require curated + CI-validated recommendations only.

## Enforcement

| Gate | Mechanism |
|------|-----------|
| Product overlay | `scripts/apply-product.mjs` refuses Marketplace URLs |
| Static audit | `scripts/audit-product-json.mjs` |
| Recommendations | `scripts/audit-recommendations.mjs` — fail closed vs live Open VSX |
| CI | `.github/workflows/recommendations-audit.yml` + weekly schedule |
| Release | `phaseD:verify` must pass before RC |

## Product fields (locked)

```json
"extensionsGallery": {
  "serviceUrl": "https://open-vsx.org/vscode/gallery",
  "itemUrl": "https://open-vsx.org/vscode/item",
  "latestUrlTemplate": "https://open-vsx.org/vscode/gallery/{publisher}/{name}/latest",
  "controlUrl": "https://raw.githubusercontent.com/EclipseFdn/publish-extensions/refs/heads/master/extension-control/extensions.json"
},
"walkcroach": {
  "marketplaceProxy": false
}
```

If feature-parity pressure asks for Marketplace access: **decline**, document the gap in `product/incompatibles.proprietary.json`, and suggest Open VSX alternatives.
