# WalkCroach Desktop — Shipping

**Architecture:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) · **Status:** [`STATUS.md`](./STATUS.md)

How to build, run, package, and distribute. Pin and **unsigned preview** distribution policy live here (single ops doc).

Desktop is a **production-grade** WalkCroach surface (parity with IDE / CLI / Web / Chrome). The only shipping caveats today: builds are **unsigned** and the public channel is **preview / insider**.

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

Needs **≥15 GB free**, Node **24.18.0**, and sibling `../walkcroach` for `@walkcroach/agent-engine` + `@walkcroach/sdk`.

```bash
cd walkcroach-desktop
npm run apply:product
cd vscode && npm ci && npm run compile   # or watch
# Windows: scripts\code.bat
```

Also build agent packages used at runtime:

```bash
# from walkcroach/
cd packages/sdk && npm run build
cd packages/agent-engine && npm run build
cd packages/agent-protocol && npm run build
# from walkcroach-desktop/
cd packages/desktop-agent && npm install && npm run build
cd packages/agent-ui && npm install && npm run build    # refreshes contrib media bundles
```

Verify structure (no full gulp required):

```bash
npm run verify          # product gate: wiring + audits + tests
npm run verify:fast     # skip tests / upstream dry-run
```

---

## 3. Preview distribution policy (unsigned)

**Public channel today:** Windows **Inno Setup** installer (unsigned) — falls back to 7-Zip SFX if `ISCC.exe` is missing. Quality **`insider` / preview**, **not code-signed**. Product maturity is still production-grade; SmartScreen warnings are a signing gap, not a feature-maturity gap.

Stable CDN URL (after `infra-web` apply + `npm run publish:desktop-cdn`):

`https://{desktop-cf}/desktop/preview/latest/WalkCroach-Setup.exe`

| Do | Do not |
|----|--------|
| Publish Setup.exe + `SHA512SUMS` to S3/CloudFront | Claim “signed” / “notarized” |
| Document SmartScreen → More info → Run anyway | Market macOS/Linux as public channels yet |
| Call it **unsigned preview** (production-grade product) | Call it dogfood / incomplete relative to other surfaces |
| Keep Open VSX audits green | Enable `signed-release` CI without certs |
| | Point users at empty update CDN as “auto-update” |

Auto-update and Azure Artifact Signing / Apple notarization are **deferred until funded**. Prefer Azure Trusted Signing (~$10/mo) over EV USB tokens when budget appears.

Install guide for end users is §5 below.

---

## 4. Package Windows portable + Setup.exe (operator machine)

Requires nested `vscode/` with WalkCroach fork code + sibling `walkcroach/` + **Inno Setup** via `vscode/node_modules/innosetup` (or 7-Zip SFX fallback — see `packaging/sfx/README.md`).

```bash
cd walkcroach-desktop
npm run package:windows-portable
# After a failed package step with out-vscode still present, reuse it:
# npm run package:windows-portable -- --package-only
# Disk-friendly: skip zip, then reclaim intermediates:
# npm run package:windows-portable -- --skip-zip
# Fail closed on size (default budget 100 MiB for Setup.exe):
# npm run package:windows-portable -- --skip-zip --enforce-size
# npm run clean:package
```

Needs ~15 GB free: the minified build materialises `out-build`, `out-vscode-min`,
`.build/extensions` and the package folder simultaneously.

Artifacts in `packaging/dist/`:

- `WalkCroach-Setup-win32-*-insider-unsigned.exe` — **preferred** end-user download (Inno wizard)
- `WalkCroach-win32-*-insider-unsigned.zip` — optional portable folder zip
- `SHA512SUMS`

### Installer size

**Measured: 118.2 MiB** (`Setup.exe`, win32-arm64, 2026-08-09), from a 563.5 MiB
package folder. `--enforce-size` guards at **125 MiB** — a regression guard just
above the achieved size, not a target.

| Lever | Effect |
|---|---|
| Drop built-in Copilot | ~431.8 MiB of package payload — the single biggest item |
| Minified gulp target | roughly halves core JS vs unminified |
| `lzma2/ultra64` vs `lzma2/max` | 130.5 -> 118.2 MiB |
| Trim (locales, icons) | 46.9 MiB of package payload |

Reaching ~100 MiB needs a product decision, not a build flag. The candidates:

- `mermaid-markdown-features` — **58.5 MiB**, 7x the next largest extension.
  Removing it costs mermaid diagram rendering in markdown preview.
- `dxcompiler.dll` (23.2) + `vk_swiftshader.dll` (19.6) + `d3dcompiler_47.dll`
  (7.8) — the graphics fallback stack. Removing these trades a hard crash on
  VMs and some ARM64 configurations for a few MiB. Not recommended.
- `LICENSES.chromium.html` (19.4) is legally required and compresses ~10x, so
  it contributes only ~2 MiB to the installer. Leave it.

Three things hold the current size, in order of weight:

1. **Minified build.** Packaging uses the `vscode-win32-<arch>-min` gulp target
   (`out-vscode-min`: mangled + minified). The unminified `vscode-win32-<arch>`
   target roughly doubles the installer — it is debugging-only, behind
   `--no-minify`. The historical "stock Code OSS ≈220 MiB" note in this doc
   described an unminified build; it was never a floor.
2. **Source-map stripping.** `gulpfile.vscode.ts` strips `*.{js,css}.map` from
   both core and `node_modules` only when it thinks it is in CI
   (`stripSourceMapsInPackagingTasks = isCI`). The packaging script therefore
   sets `CI=1` for the gulp invocation. `trim-package.mjs` also deletes any
   stragglers, so a hand-run gulp without `CI=1` still ships clean.
3. **Trim.** `scripts/trim-package.mjs` removes non-`en-US` Chromium locale
   paks, `.ico` files no association references, and test extensions.

**Copilot is not bundled.** `vscode/build/gulpfile.vscode.ts` gates the built-in
GitHub Copilot extension behind `includeCopilot` (default off; set
`WALKCROACH_INCLUDE_COPILOT=1` to restore upstream behaviour). WalkCroach ships
its own agent, so Copilot was redundant product surface *and* a build hazard:
`ensureCopilotPlatformPackage` shells out to `npm pack @github/copilot-<platform>`
with no timeout, which hangs the build indefinitely when that scoped package
cannot be fetched. This is a **fork patch** — re-apply it after `sync:upstream`.

Note `product.json` still carries `defaultChatAgent` pointing at `GitHub.copilot`.
Leave it: stock Code OSS ships the same value without bundling the extension, and
36 read sites in extension-management and gallery code access it without null
checks, so removing the key throws during normal marketplace use.

```bash
npm run size:census -- <packageRoot> --json out.json   # what the folder is made of
npm run size:census -- <packageRoot> --baseline old.json  # diff two builds
npm run trim:package -- <packageRoot> --dry-run        # preview removals
```

Every build writes `packaging/dist/size-census.json`. When `--enforce-size`
fails, read that first — it names the subtree that grew.

Not touched, deliberately: `vk_swiftshader.dll`, ffmpeg, and ANGLE binaries all
have plausible runtime consumers (software rendering fallback on VMs and some
ARM64 configurations). They are visible in the census if the budget ever needs
them, but removing them trades a hard crash on affected machines for a few MiB.

### Inno installer

Per-user by default: installs to `%LOCALAPPDATA%\Programs\WalkCroach`, no elevation, and
offers Launch on finish. `packaging/inno/walkcroach.iss` follows upstream
`vscode/build/win32/code.iss`, minus background updates, AppX, and ESRP signing.

Optional wizard tasks:

| Task | Default | Effect |
|------|---------|--------|
| `desktopicon` | off | Desktop shortcut |
| `addcontextmenufiles` | off | "Open with WalkCroach" on files |
| `addcontextmenufolders` | off | "Open with WalkCroach" on folders, folder backgrounds, drives |
| `associatewithfiles` | **on** | Registers 46 file types (see `packaging/inno/file-associations.json`) |
| `addtopath` | **on** | Adds `{app}\bin` to PATH; removed cleanly on uninstall |

Direct invocation, for a per-machine build or to inspect preprocessed output:

```bash
node scripts/make-windows-inno.mjs <packageRoot> <outExe> [--machine] [--sign] [--debug]
```

`--machine` installs to Program Files under a distinct AppId, so per-user and
per-machine installs coexist rather than corrupting each other. `--sign` is a
placeholder that fails unless `INNO_SIGN_TOOL` is configured — output today is
unsigned and SmartScreen will warn.

The `[Registry]` association block is **generated** into
`packaging/inno/generated/associations.iss` (gitignored) on every build from
`file-associations.json`. Edit the JSON, never the generated file. The generator
fails closed on a duplicate extension, a comma in a label, or an icon that does
not exist in `vscode/resources/win32/` — which also makes that JSON the allowlist
for which `.ico` files are load-bearing during size work.

Two known gaps: the URL protocol (`walkcroach://`) is registered at runtime by
Electron rather than by the installer (matching upstream), and the Explorer
context menu uses classic shell verbs, so on Windows 11 it appears under
"Show more options". The modern top-level Win11 menu needs the AppX sparse
package plus the CLSID already present in `product.json` `win32ContextMenu`.

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
3. Run the Setup.exe — Inno wizard (or SFX extract on older builds); SmartScreen: **More info → Run anyway** (expected while unsigned on the preview channel).
4. App installs under `%LOCALAPPDATA%\Programs\WalkCroach`.
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
