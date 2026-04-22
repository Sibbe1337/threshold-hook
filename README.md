# threshold-hook

`threshold-hook` is a small CLI and TypeScript package for threshold-based alerts in cron, CI, and custom workflows.

It lives under **Open source by Capped**: small, scriptable guardrails for developers who do not want another dashboard.

Use it when you already have the number and just need sane alerting.

- Node 18+
- TypeScript
- Zero runtime dependencies
- Slack / Discord / generic webhooks
- Local state-file dedupe

```bash
npm install threshold-hook
```

## Why It Exists

`capped-cost` is the opinionated tool in the Capped ecosystem. It knows how to fetch OpenAI and Anthropic spend.

`threshold-hook` is the lower-level sibling. It does not know where your number comes from. It only answers:

- did the value cross the threshold?
- is it still breached?
- is cooldown still active?
- did it recover?
- should a webhook fire right now?

That makes it useful for queue depth, spend, latency budgets, error counts, remaining credits, or any other numeric guardrail you already compute elsewhere.

## What It Is Not

- not a dashboard
- not a monitoring platform
- not a hosted service
- not a replacement for Datadog, Grafana, or Prometheus

If you need storage, charts, queries, agents, or a control plane, this is the wrong tool.

## Quickstart

Raw number on stdin:

```bash
echo 87 | threshold-hook --cap=100 --threshold=0.8
```

Direct value:

```bash
threshold-hook --value=92 --cap=100 --threshold=0.8 --label="queue depth"
```

Extract a number from JSON on stdin:

```bash
curl -s https://example.com/metrics.json \
  | threshold-hook \
      --json-path=data.total \
      --cap=100 \
      --threshold=0.8 \
      --webhook="$WEBHOOK_URL"
```

## How It Works

Inputs:

- `--value=<number>`
- raw numeric stdin
- `--json-path=<path>` over stdin JSON

Threshold logic:

- `thresholdValue = cap * threshold`
- `--direction=above` breaches when `value >= thresholdValue`
- `--direction=below` breaches when `value <= thresholdValue`

State and dedupe:

- uses `.threshold-hook.state.json` by default
- alerts immediately on crossing
- suppresses repeats during cooldown
- sends reminder alerts after cooldown if still breached
- sends a recovery alert when the value returns to normal

## CLI

```bash
threshold-hook [options]
```

Required:

- `--cap=<number>`
- `--threshold=<ratio>`

Options:

- `--value=<number>`
- `--json-path=<path>`
- `--direction=above|below`
- `--cooldown-minutes=<number>` default `60`
- `--label=<string>`
- `--webhook=<url>`
- `--state-file=<path>`
- `--format=json|table`
- `--no-color`
- `-h`, `--help`
- `-v`, `--version`

## Exit Codes

- `0` normal / recovered / no alert needed
- `1` config or input error
- `2` threshold currently breached
- `3` webhook failed after an alert-worthy event

## JSON Output

JSON output is stable and includes `schemaVersion`.

```bash
threshold-hook --value=92 --cap=100 --threshold=0.8 --format=json
```

```json
{
  "schemaVersion": 1,
  "command": "threshold-hook",
  "status": "threshold-crossed",
  "breached": true,
  "deliveryStatus": "not-configured",
  "value": 92,
  "thresholdValue": 80
}
```

## Library API

```ts
import {
  evaluateThreshold,
  loadState,
  saveState,
  postAlert,
  runThresholdHook,
} from "threshold-hook";
```

Primary exports:

- `evaluateThreshold(...)`
- `loadState(path)`
- `saveState(path, state)`
- `postAlert({ url }, payload)`
- `runThresholdHook(...)`

## When To Use It

Good fits:

- cron jobs
- GitHub Actions
- CI checks
- internal scripts
- workers that already compute a numeric value

Bad fits:

- full observability stacks
- multi-tenant hosted alerting
- use cases that need dashboards or long-term analytics

## Relationship To Capped

Capped has two paths:

- **Capped Extension** for the plug-and-play path
- **Open source by Capped** for scriptable tools in cron, CI, and custom workflows

Within that open-source path:

- `capped-cost` is the spend-specific tool for OpenAI + Anthropic
- `threshold-hook` is the generic threshold primitive

## Development

```bash
npm ci
npm run verify
```

## Related Docs

- [SECURITY.md](./SECURITY.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CHANGELOG.md](./CHANGELOG.md)
