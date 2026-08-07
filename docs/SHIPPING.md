# WalkCroach Desktop — Shipping

**Architecture:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) · **Status:** [`STATUS.md`](./STATUS.md)

How to build, run, package, and distribute. Pin and preview policy live here (single ops doc).

---

## 1. Upstream pin

| Field | Value |
|-------|--------|
| Tag | `1.131.0` |
| Commit | `3a03d6f72d628a7741c29f456b4ddbb5ae68502c` |
| Electron | `42.7.0` |
| Node (build) | `24.18.0` |
| Why this pin | Agent Host shipped in 1.130+; 1.131 adds worktree/session work used by Path B |

Authoritative copy also in `product/product.walkcroach.json` → `walkcroach.upstream*`. Audits read the product overlay (not a separate pin file).

Nested `vscode/` must be at this pin **or a descendant** (WalkCroach commits on top).

---

## 2. Dev compile / launch

Needs **≥15 GB free**, Node **24.18.0**, and sibling `../walkcroach` for `@walkcroach/agent-engine`.

```bash
cd walkcroach-desktop
npm run apply:product
cd vscode && npm ci && npm run compile   # or watch
# Windows: scripts\code.bat
```

Also build agent packages used at runtime:

```bash
# from walkcroach/
cd packages/agent-engine && npm run build
# from walkcroach-desktop/
cd packages/desktop-agent && npm run build
cd packages/agent-ui && npm run build    # refreshes contrib media bundles
```

Verify structure (no full gulp required):

```bash
npm run verify          # product gate: wiring + audits + tests
npm run verify:fast     # skip tests / upstream dry-run
```

---

## 3. Preview distribution policy (unsigned)

**Public channel today:** Windows **self-extracting Setup.exe** (7-Zip SFX) plus optional portable `.zip`, quality **`insider`**, **not code-signed**.

Stable CDN URL (after `infra-web` apply + `npm run publish:desktop-cdn`):

`https://{desktop-cf}/desktop/preview/latest/WalkCroach-Setup.exe`

| Do | Do not |
|----|--------|
| Publish Setup.exe + `SHA512SUMS` to S3/CloudFront | Claim “signed” / “notarized” |
| Document SmartScreen → More info → Run anyway | Market macOS/Linux as production |
| Treat as preview / dogfood | Enable `signed-release` CI without certs |
| Keep Open VSX audits green | Point users at empty update CDN as “auto-update” |

Auto-update and Azure Artifact Signing / Apple notarization are **deferred until funded**. Prefer Azure Trusted Signing (~$10/mo) over EV USB tokens when budget appears.

Install guide for end users is §5 below.

---

## 4. Package Windows portable + Setup.exe (operator machine)

Requires nested `vscode/` with WalkCroach fork code + sibling `walkcroach/` + **7-Zip** (`7z.sfx` — see `packaging/sfx/README.md`).

```bash
cd walkcroach-desktop
npm run package:engine-bundle          # → engine-bundle.cjs (+ mirror into vscode media)
npm run package:windows-portable       # apply-product → gulp → inject → zip → Setup.exe → SHA512SUMS
# optional: --arch=arm64 | --skip-gulp if VSCode-win32-* already built
npm run publish:desktop-cdn -- --env=dev   # → stable CloudFront latest Setup.exe
# optional GitHub Release mirror:
npm run release:windows-portable -- --tag desktop-v0.1.0-preview.1
```

Artifacts in `packaging/dist/`:

- `WalkCroach-Setup-win32-*-insider-unsigned.exe` — **preferred** end-user download
- `WalkCroach-win32-*-insider-unsigned.zip` — portable folder zip
- `SHA512SUMS`

SFX extracts to `%LOCALAPPDATA%\Programs\WalkCroach` and launches `WalkCroach.exe`.

**Inject step** copies into packaged `resources/app/out/`:

- `…/walkcroach/media/engine-bundle.cjs`
- `…/contrib/walkcroach/browser/media/agent-ui.js`
- `…/contrib/walkcroach/browser/media/settings-ui.js`

Gulp resource globs do not ship these prebuilt assets alone.

### CI reality

| Workflow | Does |
|----------|------|
| `release-windows-portable.yml` | Builds/smoke-tests **engine-bundle**; audits; does **not** gulp zip/exe |
| `package-matrix.yml` | `npm run verify:fast`; smoke jobs are echoes; signed job disabled |
| `recommendations-audit.yml` / `openvsx-recommendations.yml` | Open VSX audits; surface-area only if `vscode/.git` present |
| `upstream-sync.yml` | Sync helper (fix clone pin if updating — keep aligned with §1) |

---

## 5. Preview install (end user)

1. Download **WalkCroach-Setup.exe** from the landing page (CloudFront stable URL) or GitHub Releases.
2. Optionally verify SHA-512 against `SHA512SUMS`.
3. Run the Setup.exe — extract when prompted; SmartScreen: **More info → Run anyway** (expected for unsigned preview).
4. App launches from `%LOCALAPPDATA%\Programs\WalkCroach`.
5. Update by downloading a newer Setup.exe (no claimed auto-update).

Do not paste Cognito/Bedrock secrets into issues.

---

## 6. Signing (when funded)

| Platform | Path |
|----------|------|
| Windows | Prefer **Azure Artifact Signing (Trusted Signing)** via OIDC — Basic ~$9.99/mo |
| macOS | Apple Developer Program + Developer ID + `notarytool` + `packaging/entitlements.mac.plist` |
| Linux | `.deb` / tarball + checksums (optional GPG) |

Secrets go in org secret store / GitHub Actions — **never** commit private keys. EV USB tokens are a poor fit for CI; cloud HSM / Trusted Signing only.

Until then: leave `signed-release` disabled.

---

## 7. Infra modules

| Module | Code reality |
|--------|----------------|
| `infra/desktop-update` | S3 bucket + versioning + `desktop/stable` & `desktop/insiders` placeholders; **no CloudFront** resources yet |
| `infra/desktop-crash` | Lambda + HTTP API `POST /desktop/v1/crash`; unit-tested handler |

Wire into the main WalkCroach Terraform stack when deploying; modules are not empty stubs.

---

## 8. Upstream cadence

- Script: `scripts/sync-upstream.sh` (`npm run sync:upstream:dry`).
- Records: `cadence/` (owner, checklist, KPI).
- Conflict notes: `cadence/upstream/` (created by sync when needed).
- Allowlist: `product/surface-area-allowlist.txt`.
- Security fast-path: bump pin, rebuild portable zip, publish checksums — do not wait on feature work.

**Quarterly:** run `npm run audit:surface-area`; prune dead contrib (see STATUS dead-code list).

---

## 9. Release notes

- Preview: `packaging/RELEASE_NOTES.preview.md`
- Template (FR-style Upstream absorbed / WalkCroach-specific): `packaging/RELEASE_NOTES.TEMPLATE.md`
- Signing checkboxes stay unchecked for unsigned preview releases.
