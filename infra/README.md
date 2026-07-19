# Desktop-only additive infra (Phase E)

Modules here are **not** a second identity/memory plane. They host:

| Module | Purpose |
|--------|---------|
| `desktop-update/` | S3 update bucket + channel prefixes (CloudFront optional) |
| `desktop-crash/` | Opt-in crash ingest Lambda + HTTP API |

Wire into `walkcroach/infra-backend` when ready (DNS/ACM/CI package zip). Until then, `terraform plan` locally against a sandbox account is safe.

```bash
# Crash lambda unit tests
node --test infra/desktop-crash/codes/test.mjs

# Package zip for terraform zip_path
npm run package:crash-lambda
```
