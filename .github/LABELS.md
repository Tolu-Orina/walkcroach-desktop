# Label: upstream-candidate
# Color suggestion: #5319E7
# Description: Reproduces in stock VS Code / VSCodium — track upstream, not WalkCroach backlog (FR-F21)

When bug_report.yml triage answers “Yes — reproduces in stock VS Code/VSCodium”:

1. Apply label `upstream-candidate`
2. Link upstream issue if filed (microsoft/vscode or VSCodium)
3. Do not treat as WalkCroach product P0 unless Desktop-specific aggravation exists

Manual for now; optional GitHub Action can auto-label when issue body contains the checkbox.
