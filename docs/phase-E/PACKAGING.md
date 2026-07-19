# Packaging matrix (PE.1)

| OS | Runner | Unsigned artifact (CI smoke) | Signed release |
|----|--------|------------------------------|----------------|
| Windows | `windows-latest` | `.zip` / setup unsigned | Azure Artifact Signing → `.exe` |
| macOS | `macos-latest` | `.zip` of `.app` unsigned | Developer ID + notarize → `.dmg` |
| Linux | `ubuntu-latest` | `.tar.gz` | checksums (+ optional GPG) |

Full `vscode` `npm ci` + gulp package requires ≥15GB free on the runner (GitHub-hosted OK). Local packaging remains disk-gated — see `docs/phase-A/COMPILE.md`.

Workflow: `.github/workflows/package-matrix.yml`
