# Interim distribution — Windows portable (unsigned)

**Status:** ACCEPTED  
**Date:** 2026-07-19  
**Decision ID:** `DEC-2026-07-19-windows-portable-interim`  
**Maps to:** FR-F17 / NFR-F05 (deferred paid signing), Phase E

## Context

Apple Developer Program (~$99/yr) and Azure Artifact Signing are **not affordable right now**. Phase E scaffolding (update channels, checksums, crash ingest, signed CI gates) remains in place for when enrollment is possible.

## Decision

**Ship WalkCroach Desktop for now as a Windows portable artifact:**

| Artifact | Role |
|----------|------|
| **Windows portable `.zip`** (preferred) | Primary download — unpack and run |
| **Windows portable `.exe`** (optional companion) | Same bits, single-file launcher if packaging allows |
| Checksums | `SHA512SUMS` (or SHA-256) published next to the release |
| Channel | GitHub Releases under `downloadUrl`; treat as **`insiders` / preview**, not a notarized “general release” |

**Out of interim scope**

| Platform | Policy |
|----------|--------|
| macOS | Dev/CI unsigned only — Gatekeeper warn; not marketed as production |
| Linux | Optional `.tar.gz` / AppImage for demos; checksums required |
| Auto-update to signed CDN | Deferred until Developer ID + Windows signing exist |

## Explicit non-claims (NFR-F05)

- Do **not** describe interim builds as “code-signed” or “notarized.”
- Do **not** enable the `signed-release` CI job until secrets exist.
- SmartScreen may warn on first Windows download — document “More info → Run anyway” for preview users.
- When Apple / Azure signing is funded: promote the same channel to signed installers without changing product architecture (`docs/phase-E/SIGNING.md`).

## Release checklist (interim)

- [ ] Build Windows portable zip (and optional exe) from pinned vscode
- [ ] Publish GitHub Release with `SHA512SUMS`
- [ ] Release notes use FR-F19 template (**Upstream absorbed** vs **WalkCroach-specific**)
- [ ] Link from README: “Preview — Windows portable (unsigned)”
- [ ] Keep Open VSX recommendation audit green

## Revisit when

1. Apple Developer Program enrolled → macOS `.dmg` + notarization  
2. Windows signing (Trusted Signing or EV) enrolled → signed setup + SmartScreen path  
3. Then flip `package-matrix.yml` signed job and point `stable` manifests at S3/CloudFront
