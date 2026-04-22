# Changelog

## 0.1.2 - 2026-04-22

- fixed `npx threshold-hook --help` and other direct CLI invocations when npm runs the command through a symlinked bin path
- added a regression test for symlink-based direct invocation

## 0.1.1 - 2026-04-22

- added repository and issue metadata to the published package
- aligned the npm package with the public GitHub repository

## 0.1.0 - 2026-04-22

Initial release.

- threshold-based CLI for cron, CI, and custom workflows
- supports stdin, `--value`, and `--json-path`
- local state-file dedupe with cooldowns and recovery alerts
- Slack, Discord, and generic webhook delivery
- stable JSON output with `schemaVersion`
- small library API for embedding in scripts
