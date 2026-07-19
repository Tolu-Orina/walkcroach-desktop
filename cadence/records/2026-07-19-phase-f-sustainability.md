# Upstream sync — 2026-07-19 (Phase F sustainability)

- Kind: **cadence keepalive** (PF.1 / NFR-F12) — same calendar day as Phase A bootstrap; documents Phase F tooling live
- Sync: dry-run via `scripts/sync-upstream.sh --dry-run` (pin unchanged)
- Pinned HEAD: `125df4672b8a6a34975303c6b0baa124e560a4f7` (tag `1.129.0`)
- Conflicts: none
- Distribution decision: Windows portable interim — `docs/phase-E/INTERIM_DISTRIBUTION.md`

## Checklist

- [x] Cadence KPI script (`scripts/cadence-kpi.mjs`)
- [x] Conflict log path on failed merge (`docs/upstream/`)
- [x] Decision log (`docs/decisions/`)
- [x] Quarterly surface-area scaffold
- [x] `upstream-candidate` label workflow + issue form
- [x] Security patch fast-path doc
- [ ] Next real upstream merge ≤ 2026-08-02

## Next due

≤ 2026-08-02 (14-day cadence) or security tag — whichever first.
