# Quarterly surface-area budget review (PF.3 / NFR-F13)

**Cadence:** Every calendar quarter during active development.  
**Command:** `npm run audit:surface-area`  
**Allowlist:** `product/surface-area-allowlist.txt`

## Review checklist

- [ ] Run surface-area audit on current `vscode/` vs pin
- [ ] Count files outside `contrib/walkcroach/**` that diverge — must stay on allowlist or get a decision-log entry
- [ ] Trend: is fork surface growing? If yes, schedule cleanup or move logic into `packages/desktop-agent`
- [ ] Record outcome below

## Log

| Quarter | Date | Changed files (audit) | Violations | Notes |
|---------|------|----------------------|------------|-------|
| 2026-Q3 | 2026-07-19 | Phase F bootstrap | 0 expected | Baseline after Phases A–E structural work |
