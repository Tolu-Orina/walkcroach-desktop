# Update rollback & integrity (PE.7 / NFR-F10)

## Rules

1. **Verify before apply** — hash in manifest must match downloaded payload.
2. **Atomic swap** — new version lands beside current; only flip launcher/symlink after successful first launch probe.
3. **Keep N-1** — retain previous install until N launches and passes a 30s health window (process stays up).
4. **Auto-rollback** — if probe fails or hash mismatches, restore N-1 and notify the user.
5. **Never** distribute unsigned builds as `stable`/`insiders` public channels.

## Manifest fields (minimum)

```yaml
version: 1.129.0-walkcroach.1
files:
  - url: WalkCroachSetup.exe
    sha512: …
    size: …
path: WalkCroachSetup.exe
sha512: …
releaseDate: '2026-07-19T00:00:00.000Z'
```

## Test plan (Update E2E)

- [ ] Install n-1 signed build
- [ ] Publish n with valid manifest
- [ ] App updates, relaunches, version == n
- [ ] Publish broken hash → update refused / rolled back; app still launches
