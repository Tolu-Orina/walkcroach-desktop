# Phase E — Exit criteria record

**Date:** 2026-07-19  
**Plan:** `walkcroach/docs/walkcroach-desktop-ide-implementation-plan.md` § Phase E

## Task matrix

| ID | Task | Artifact | Status |
|----|------|----------|--------|
| PE.1 | CI matrix win/mac/linux | `.github/workflows/package-matrix.yml` | ✅ structural |
| PE.2 | macOS sign + notarize | `SIGNING.md` + `entitlements.mac.plist` | ✅ docs; ⏳ human certs |
| PE.3 | Windows Azure Artifact Signing | `SIGNING.md` | ✅ docs; ⏳ human enrollment |
| PE.4 | Linux packages + checksums | `PACKAGING.md` / `SIGNING.md` | ✅ |
| PE.5 | updateUrl / S3+CF design | `ARCHITECTURE.md` + `infra/desktop-update` | ✅ |
| PE.6 | stable / insiders channels | ARCHITECTURE + product `updateChannel` | ✅ |
| PE.7 | Rollback / integrity | `ROLLBACK.md` | ✅ |
| PE.8 | Release notes template FR-F19 | `RELEASE_NOTES.TEMPLATE.md` + audit | ✅ |
| PE.9 | Crash Lambda + opt-in client | `infra/desktop-crash` + `WalkCroachCrashReporter` | ✅ |
| PE.10 | Terraform scale-to-$0 modules | `infra/desktop-update`, `infra/desktop-crash` | ✅ |

## Exit criteria

| Criterion | Result |
|-----------|--------|
| Signed installers downloadable | ⏳ Deferred — interim **Windows portable** ship (`INTERIM_DISTRIBUTION.md`) |
| Auto-update macOS + Windows | ⏳ After signing + CloudFront |
| Crash path verified | ✅ Lambda unit tests + opt-in client |
| Release notes format enforced | ✅ `audit-release-notes` |
| Interim Windows portable policy documented | ✅ |

## Verify

```bash
npm run phaseE:verify
```
