# Security Policy

`threshold-hook` is intentionally small. Its main security concerns are webhook handling and local state-file behavior.

## Reporting

If you find a security issue, report it privately before opening a public issue.

Include:

- affected version
- reproduction steps
- whether secrets, webhooks, or state files are involved

## Security Model

- no runtime dependencies
- no telemetry
- no remote storage
- no hosted service
- local JSON state file only

## What To Protect

- incoming metric sources upstream of `threshold-hook`
- webhook URLs
- state files when labels or values are sensitive

Recommended practice:

- store webhook URLs in your shell or CI secrets
- avoid committing `.threshold-hook.state.json`
- avoid piping secrets into logs around the CLI

## Non-Goals

- encrypted local state
- multi-user access control
- remote secret storage
- hosted alert delivery guarantees

Those are intentionally outside scope.
