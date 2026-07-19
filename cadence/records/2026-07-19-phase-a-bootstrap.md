# Upstream sync — 2026-07-19 (Phase A bootstrap)

- Kind: **bootstrap record** (PA.9) — first cadence entry
- Repo: `walkcroach-desktop/vscode`
- Branch: `walkcroach/phase-a`
- Upstream remote: `https://github.com/microsoft/vscode.git`
- Pinned HEAD: `125df4672b8a6a34975303c6b0baa124e560a4f7` (tag `1.129.0`)
- Merge: **no-op** (already at pin; dry-run via `scripts/sync-upstream.sh --dry-run`)
- Conflicts: none
- `core.longpaths`: true (Windows)

## Checklist

- [x] Upstream remote present
- [x] Pin documented and verified (`git rev-parse HEAD`)
- [x] Sync script dry-run executed
- [ ] Full compile + smoke launch (blocked on disk — `docs/phase-A/COMPILE.md`)
- [x] `npm run audit:recommendations` (empty list)
- [x] Surface-area allowlist published
- [x] Release-notes template: Upstream absorbed vs WalkCroach-specific (see README)

## Next due

≤ 2026-08-02 (14-day cadence) or next security tag — whichever first.
