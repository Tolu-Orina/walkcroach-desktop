# Security patch fast-path (PF.6)

**When:** CVE or critical fix lands in `microsoft/vscode` between biweekly syncs.

## Steps (same day)

1. Label issue / create `security/upstream-CVE-YYYY-MM-DD`
2. `cd vscode && git fetch upstream --tags`
3. Identify patch commit or patch release tag
4. `./scripts/sync-upstream.sh --target <sha-or-tag>` (not dry-run)
5. Prefer minimal conflict resolution; **do not** expand fork surface during a security merge
6. Run `npm run audit:surface-area` + `npm run audit:recommendations`
7. Write `cadence/records/YYYY-MM-DD-security.md` + note in release notes **Upstream absorbed**
8. Ship interim Windows portable rebuild if Desktop is already distributed (`INTERIM_DISTRIBUTION.md`)

Cadence KPI: security syncs **count** as successful sync attempts (reset days-since-last).
