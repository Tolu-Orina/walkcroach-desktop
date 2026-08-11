# WalkCroach Desktop — Preview release notes

**Version:** (fill from tag)  
**Date:** (fill)  
**Channel:** insider (preview)  
**Upstream pin:** vscode (see `product/product.walkcroach.json` → `walkcroach.upstreamTag`)

---

## Signing / distribution notice

WalkCroach Desktop is a **production-grade** surface (parity with other WalkCroach clients). This build is an **unsigned Windows portable on the preview channel** (signing/notarization deferred).

- Not code-signed · not notarized · SmartScreen may warn (“More info → Run anyway”).
- Install guide: `docs/SHIPPING.md` (§ Preview install)
- Verify downloads with `SHA512SUMS` attached to this release.
- Do **not** describe this release as dogfood or incomplete relative to IDE/CLI.

## Upstream absorbed

- …

## WalkCroach-specific

- …

## Security / supply chain

- [ ] `npm run audit:recommendations` (fail closed)
- [ ] `npm run audit:surface-area`
- [ ] Engine bundle built (`npm run package:engine-bundle`)
