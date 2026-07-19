# Phase 0.4 — Code signing procurement

**Status:** CHECKLIST READY — **user action required to submit applications**  
**Recorded:** 2026-07-18  
**Maps to:** FR-F17, NFR-F05  
**Lead time:** Start now; certificates often take days–weeks.

Agents cannot complete paid enrollment or identity verification on behalf of the account holder. Complete the steps below with org credentials.

## macOS — Apple Developer Program

| Step | Action | Status |
|------|--------|--------|
| 1 | Enroll / renew at https://developer.apple.com/programs/ ($99/year) | ⬜ USER |
| 2 | Create **Developer ID Application** certificate (not Mac App Store) | ⬜ USER |
| 3 | Create App Store Connect API key (Issuer ID + Key ID + `.p8`) for notarization CI | ⬜ USER |
| 4 | Confirm Team ID; record in secrets manager (never commit) | ⬜ USER |
| 5 | Phase E: `hardenedRuntime: true` + entitlements matching app capabilities | ⬜ Phase E |

**Notarization note (2026):** Unsigned macOS builds cannot use a reliable auto-update path; notarization is mandatory for Gatekeeper + updater trust.

## Windows — code signing

| Step | Action | Status |
|------|--------|--------|
| 1 | Prefer **Azure Artifact Signing** (cloud CI, no USB EV token) — https://learn.microsoft.com/en-us/azure/trusted-signing/ | ⬜ USER |
| 2 | Alternative: EV code-signing certificate from a public CA (DigiCert, Sectigo, etc.) | ⬜ USER (alt) |
| 3 | Provision CI identity (OIDC / federated credential) for Trusted Signing | ⬜ USER |
| 4 | Phase E: sign `.exe` / `.msi` / update packages; publish SHA-512 in `latest.yml` | ⬜ Phase E |

**SmartScreen note (2026):** New publishers accumulate reputation over time; first installs may still warn until reputation builds.

## Linux

| Step | Action | Status |
|------|--------|--------|
| 1 | Decide packaging (`.deb` / AppImage / tarball) | ⬜ Phase E |
| 2 | GPG-sign packages or publish checksums + cosign | ⬜ Phase E |

## Secrets inventory (store outside git)

- Apple Team ID, API Key Issuer, Key ID, `.p8`
- Azure Trusted Signing account / certificate profile / tenant
- Update CDN signing keys (Phase E)

## Phase 0 exit interpretation

| Criterion | Phase 0 delivery |
|-----------|------------------|
| “signing applications submitted” | Procurement checklist + owner assignment + explicit USER checkboxes above. Submission is blocked on human account access. |

**Owner (default):** same as upstream-sync owner in `cadence/OWNER.md` until a release engineer is named.
