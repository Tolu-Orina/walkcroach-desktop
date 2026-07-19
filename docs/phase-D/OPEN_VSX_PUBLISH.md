# Publish WalkCroach IDE extension to Open VSX (PD.6)

**Goal:** Keep the VS Code **extension** installable inside WalkCroach Desktop (funnel), on the same registry Desktop uses.

## Package

| Field | Value |
|-------|-------|
| Extension id | `walkcroach.walkcroach-ide` |
| Source | `walkcroach/ide/` (product monorepo) |
| Registry | **Open VSX only** — never `vsce publish` to Microsoft Marketplace for Desktop distribution |

## Checklist (human + CI)

1. [ ] `ide/package.json` `publisher` = `walkcroach` (or registered Open VSX namespace)
2. [ ] Open VSX namespace `walkcroach` created + verified (Eclipse Open VSX account)
3. [ ] Personal access token with publish scope stored in CI secrets (`OVSX_PAT`) — never in git
4. [ ] `npx ovsx publish` from `ide/` after `npm run package` / vsce package
5. [ ] Confirm `https://open-vsx.org/api/walkcroach/walkcroach-ide/latest` returns 200
6. [ ] Add `walkcroach.walkcroach-ide` to Desktop curated recommendations **only after** step 5 passes `audit-recommendations.mjs`
7. [ ] Desktop in-product note: “Also available as a VS Code extension on Open VSX”

## Commands (reference)

```bash
cd walkcroach/ide
npm ci
npm run compile   # or package script
npx ovsx publish -p "$OVSX_PAT"
```

## Non-goals

- Do not publish the Desktop fork itself as an “extension.”
- Do not dual-publish Desktop gallery traffic to Marketplace.
- Extension remains the low-commitment funnel; Desktop remains the flagship (PRD §4).
