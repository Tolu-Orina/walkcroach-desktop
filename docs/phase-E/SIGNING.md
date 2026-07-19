# Phase E — Signing (PE.2–PE.4)

**Human enrollment still required** — complete Phase 0 `SIGNING_PROCUREMENT.md` checkboxes before enabling signed CI jobs.

**Interim (2026-07-19):** Ship **Windows portable zip/exe** with checksums only — see [`INTERIM_DISTRIBUTION.md`](./INTERIM_DISTRIBUTION.md). Do not claim unsigned builds as code-signed general releases (NFR-F05).

## macOS (PE.2)

| Requirement | Value |
|-------------|-------|
| Certificate | Developer ID Application |
| Runtime | `hardenedRuntime: true` |
| Entitlements | `packaging/entitlements.mac.plist` |
| Notarization | `notarytool` + App Store Connect API key |
| Bundle ID | `dev.walkcroach.desktop` |

CI sketch (runs only when secrets present):

```bash
# After gulp vscode packaging produces .app
codesign --deep --force --options runtime \
  --entitlements packaging/entitlements.mac.plist \
  --sign "Developer ID Application: …" WalkCroach.app
xcrun notarytool submit WalkCroach.dmg --key … --key-id … --issuer … --wait
xcrun stapler staple WalkCroach.dmg
```

## Windows (PE.3)

Prefer **Azure Artifact Signing (Trusted Signing)** via OIDC in GitHub Actions — no USB EV token.

| Secret / var | Purpose |
|--------------|---------|
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` | Federated credential |
| Trusted Signing account + certificate profile | Sign `.exe` / `.msi` / update packages |

Publish SHA-512 in `latest.yml` alongside installer.

## Linux (PE.4)

| Artifact | Notes |
|----------|-------|
| `.deb` | Ubuntu/Debian family (NFR-F15) |
| `.AppImage` or `.tar.gz` | Portable fallback |
| Checksums | `SHA512SUMS` published with release |
| Optional | GPG detach-sign `SHA512SUMS.asc` or cosign |

Unsigned Linux tarballs for **CI smoke only** — not general release (NFR-F05).

## CI gating

`package-matrix.yml` builds **unsigned** artifacts when signing secrets are absent (structural).  
Job `signed-release` is `if: secrets…` so forks/PRs never claim a signed release without credentials.
