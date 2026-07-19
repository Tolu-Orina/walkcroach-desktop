# Upstream conflict & sync log (PF.1 / FR-F20)

Every biweekly sync attempt (including dry-runs and failed merges) must leave a record:

1. `cadence/records/YYYY-MM-DD.md` — checklist + outcome  
2. Optional detail here: `docs/upstream/YYYY-MM-DD-conflicts.md` when conflicts ≠ none  

## Index

| Date | Kind | Target | Conflicts? | Record |
|------|------|--------|------------|--------|
| 2026-07-19 | bootstrap dry-run | `1.129.0` | no | `cadence/records/2026-07-19-phase-a-bootstrap.md` |

## Conflict file template

```markdown
# Upstream conflicts — YYYY-MM-DD

- Target: `tag-or-sha`
- Branch: `sync/upstream-YYYY-MM-DD`

| Path | Resolution | Why |
|------|------------|-----|
| `src/vs/…` | ours / theirs / mixed | Prefer keeping WalkCroach under `contrib/walkcroach/` |

## Notes
```

Void-class freeze = **P0**: if days-since-last-sync-attempt > 14 during active development, open a P0 issue and run `npm run sync:upstream:dry` the same day.
