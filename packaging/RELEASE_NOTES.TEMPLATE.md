# WalkCroach Desktop — Release notes template (FR-F19 / PE.8)

**Version:** X.Y.Z-walkcroach.N  
**Date:** YYYY-MM-DD  
**Channel:** stable | insiders  
**Upstream pin:** vscode `TAG` @ `COMMIT`

---

## Upstream absorbed

List microsoft/vscode commits/tags merged in this release (not WalkCroach product work).

- …

## WalkCroach-specific

List changes under `contrib/walkcroach/`, `product/`, `packages/desktop-agent/`, Desktop infra.

- …

## Signing

- [ ] macOS Developer ID + notarized
- [ ] Windows Azure Artifact Signing
- [ ] Linux checksums (+ GPG if used)
- [x] **Interim:** unsigned Windows portable on the preview channel — do not check the boxes above until signing is funded (product remains production-grade)

## Update

- [ ] Manifests published to `updates.walkcroach.dev/desktop/{channel}/`
- [ ] Differential `.blockmap` present for supported platforms
- [ ] Rollback probe passed on reference machine

## Security / supply chain

- [ ] `npm run audit:recommendations` (fail closed)
- [ ] `npm run audit:incompatibles`
- [ ] Surface-area budget clean
