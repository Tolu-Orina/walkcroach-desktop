# Phase E — Distribution architecture

**Status:** STRUCTURAL (certs + live signed builds require human enrollment — see Phase 0 `SIGNING_PROCUREMENT.md`)  
**Maps to:** FR-F17–F19, NFR-F05/F10/F17/F18

## Delivery plane (Desktop-owned, additive)

```text
GitHub Actions (win / mac / linux)
        │  package + sign (when secrets present)
        ▼
Artifacts → S3 update bucket (private) ──CloudFront──► https://updates.walkcroach.dev/desktop/{channel}/
        │                                              latest.yml / latest-mac.yml / latest-linux.yml
        │                                              *.exe *.dmg *.AppImage + .blockmap (differential)
        ▼
WalkCroach Desktop (quality=stable|insiders) polls updateUrl

Crash (opt-in, independent of enableTelemetry=false):
  Desktop ──POST──► API Gateway + Lambda (desktop-crash) ──► CloudWatch Logs (no PII / no prompts)
```

## Channels (PE.6)

| Channel | `product.json` `quality` | Manifest prefix |
|---------|--------------------------|-----------------|
| `stable` | `stable` | `/desktop/stable/` |
| `insiders` | `insider` | `/desktop/insiders/` |

**Current public ship:** GitHub Releases **Windows portable zip/exe** (unsigned preview) — [`INTERIM_DISTRIBUTION.md`](./INTERIM_DISTRIBUTION.md). Treat as `insiders` until signing is funded.

Staged rollout: publish to `insiders` first; promote manifests to `stable` after soak. Percentage gates are CloudFront / S3 object versioning + delayed `latest.yml` copy (document in RELEASE.md).

## Update client (PE.5)

VS Code / Electron update service uses `updateUrl` from product.json:

```
https://updates.walkcroach.dev/desktop
```

Per-platform manifests follow electron-updater / VS Code conventions under `{channel}/`. Differential updates via `.blockmap` alongside full installers (FR-F18).

Until DNS/CloudFront exist, GitHub Releases may host the same layout under `downloadUrl` with checksums — never unsigned “general release” (NFR-F05).

## Integrity + rollback (PE.7 / NFR-F10)

1. Verify SHA-512 (or SHA-256) from manifest **before** apply.
2. Keep previous install staging directory until new binary launches successfully.
3. On launch failure / hash mismatch: restore previous; surface “update rolled back” notification.
4. Never leave partial replace as the only runnable binary.

See `ROLLBACK.md`.

## Scale to $0 idle (NFR-F18)

| Resource | Idle cost driver |
|----------|------------------|
| S3 + CloudFront | Storage + request; no always-on compute |
| Crash Lambda | Invocations only; reserved concurrency 0; no VPC |
| API Gateway HTTP | Pay-per-request |

No second Cognito/CRDB. Crash path stores **metadata only** (app version, OS, stack hash) — never prompt bodies, tokens, or SQL (plan §9).
