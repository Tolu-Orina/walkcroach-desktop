# DEC-2026-07-19 — Windows portable interim ship (defer paid signing)

**Status:** Accepted  
**Phase:** E → F  
**Related:** `docs/phase-E/INTERIM_DISTRIBUTION.md`, NFR-F05, FR-F17

## Decision

Ship **Windows portable zip/exe** with checksums as the only public preview distribution until Apple Developer ID and Windows code signing are affordable.

## Why

Paid signing is blocked on budget. Blocking all Desktop distribution on certs would stall demos and Phase F sustainability work. NFR-F05 allows unsigned builds if they are **not** positioned as general signed releases.

## Consequences

- SmartScreen / Gatekeeper warnings expected; documented for users.
- Auto-update CDN + signed CI remain scaffolded, unused for public `stable` until enrollment.
- macOS/Linux public marketing deferred.

## Revisit triggers

Budget for Apple Developer Program (~$99/yr) and/or Azure Artifact Signing / EV cert.
