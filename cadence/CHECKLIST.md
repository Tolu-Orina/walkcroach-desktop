# Upstream sync cadence checklist (NFR-F12)

**Cadence:** ≤ 14 days between sync attempts during active development.  
**Owner:** see `OWNER.md`.  
**Phase 0 note:** Full `microsoft/vscode` tree is not cloned yet (Phase A). Use this checklist from the first Phase A merge onward. Phase 0 records the process and a dry-run timestamp.

## Per-sync checklist

Copy to `cadence/records/YYYY-MM-DD.md` when executing.

- [ ] Confirm owner from `OWNER.md`
- [ ] `git fetch upstream` (remote → `https://github.com/microsoft/vscode.git`)
- [ ] Identify target: latest stable tag or security patch commit
- [ ] Create branch `sync/upstream-YYYY-MM-DD`
- [ ] Merge/rebase upstream into fork branch
- [ ] Resolve conflicts — prefer keeping changes inside `src/vs/workbench/contrib/walkcroach/`
- [ ] Run compile + smoke launch
- [ ] Run recommendation audit (`scripts/audit-recommendations` — Phase A)
- [ ] Record conflicts resolved (files + 1-line reason)
- [ ] Open PR / merge; note in release notes under **Upstream absorbed**
- [ ] Update KPI: days since last successful sync = 0

## Phase 0 dry-run record

| Field | Value |
|-------|--------|
| Date | 2026-07-18 |
| Kind | Process dry-run (no vscode tree yet) |
| Upstream target (planned) | tag `1.129.0` @ `125df4672b8a6a34975303c6b0baa124e560a4f7` |
| Result | Checklist + owner published; first real merge deferred to Phase A (PA.9) |
| Next due | ≤ 2026-08-01 or Phase A bootstrap, whichever first |

## KPI log (append)

| Date | Days since previous | Success? | Notes |
|------|---------------------|----------|-------|
| 2026-07-18 | n/a | dry-run | Phase 0 process established |
| 2026-07-19 | 1 | bootstrap | Phase A: pin verified, sync dry-run OK, record `2026-07-19-phase-a-bootstrap.md` |
| 2026-07-19 | 0 | phase-F | Sustainability tooling + Windows portable interim decision; KPI via `npm run cadence:kpi` |
