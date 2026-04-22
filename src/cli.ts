#!/usr/bin/env node

import { fstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { EXIT_CODES, JSON_SCHEMA_VERSION, type Direction, type OutputFormat } from "./constants.js";
import { createStyles, colorizeStatus, describeRecovery, describeThreshold, formatComparison, formatNumber, formatPercent } from "./format.js";
import { parseNumericInput } from "./input.js";
import { runThresholdHook } from "./run.js";

const VERSION = readPackageVersion();

export interface CliRunDeps {
  colorEnabled?: boolean;
  cwd?: string;
  fetch?: typeof globalThis.fetch;
  now?: Date;
  stderr?: NodeJS.WritableStream;
  stdinData?: string;
  stdout?: NodeJS.WritableStream;
}

function readPackageVersion(): string {
  const packageJsonPath = resolve(fileURLToPath(new URL("../package.json", import.meta.url)));
  const json = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  return json.version || "0.0.0";
}

function parseArg(argv: string[], prefix: string): string | undefined {
  const match = argv.find((item) => item.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function parseFormat(argv: string[]): OutputFormat {
  const format = parseArg(argv, "--format=");
  if (!format) return "table";
  if (format === "json" || format === "table") return format;
  throw new Error("--format must be table or json");
}

function parseCap(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("--cap must be a positive number");
  }
  return parsed;
}

function parseThreshold(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    throw new Error("--threshold must be greater than 0 and less than or equal to 1");
  }
  return parsed;
}

function parseCooldown(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("--cooldown-minutes must be a positive number");
  }
  return parsed;
}

function parseDirection(value: string | undefined): Direction | undefined {
  if (!value) return undefined;
  if (value === "above" || value === "below") return value;
  throw new Error("--direction must be above or below");
}

function writeLine(stream: NodeJS.WritableStream, value = ""): void {
  stream.write(`${value}\n`);
}

function writeJson(stream: NodeJS.WritableStream, value: unknown): void {
  writeLine(stream, JSON.stringify(value, null, 2));
}

function writeError(stream: NodeJS.WritableStream, message: string): void {
  writeLine(stream, `Error: ${message}`);
}

function printHelp(stream: NodeJS.WritableStream): void {
  writeLine(
    stream,
    `threshold-hook ${VERSION} — small threshold-based alerts for cron, CI, and custom workflows.

USAGE
  threshold-hook [options]

INPUT
  --value=<number>             Direct numeric value
  --json-path=<path>           Extract a numeric field from stdin JSON using simple dotted paths
  (or pipe a raw number on stdin)

REQUIRED
  --cap=<number>               Maximum reference value
  --threshold=<ratio>          Threshold ratio between 0 and 1

OPTIONS
  --direction=above|below      Breach on value >= thresholdValue or value <= thresholdValue
  --cooldown-minutes=<n>       Reminder cooldown while still breached. Default: 60
  --label=<text>               Optional label used in output and webhook text
  --webhook=<url>              Slack, Discord, or generic webhook URL
  --state-file=<path>          State file path. Default: .threshold-hook.state.json
  --format=table|json          Output format. Default: table
  --no-color                   Disable ANSI color
  -h, --help                   Show this help
  -v, --version                Show version

EXAMPLES
  echo 87 | threshold-hook --cap=100 --threshold=0.8
  echo '{"data":{"total":92}}' | threshold-hook --json-path=data.total --cap=100 --threshold=0.8 --webhook=https://hooks.slack.com/...
  threshold-hook --value=12 --cap=50 --threshold=0.2 --direction=below --label="remaining budget"

EXIT CODES
  0   Normal / recovered / no alert needed
  1   Config or input error
  2   Threshold currently breached
  3   Webhook failed after an alert-worthy event
`
  );
}

async function readStdin(timeoutMs = 100): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      process.stdin.off("data", onData);
      process.stdin.off("end", onEnd);
      process.stdin.off("error", onError);
    };

    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onData = (chunk: string | Buffer) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    };

    const onEnd = () => {
      finish(Buffer.concat(chunks).toString("utf8"));
    };

    const onError = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const timer = setTimeout(() => {
      if (chunks.length === 0) {
        finish("");
      }
    }, timeoutMs);

    process.stdin.on("data", onData);
    process.stdin.on("end", onEnd);
    process.stdin.on("error", onError);
    process.stdin.resume();
  });
}

function stdinHasData(): boolean {
  try {
    const stat = fstatSync(0);
    return stat.isFIFO() || stat.isFile() || stat.isSocket();
  } catch {
    return !process.stdin.isTTY;
  }
}

function directInvocation(): boolean {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

export async function runCli(argv: string[], deps: CliRunDeps = {}): Promise<number> {
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  const colorEnabled = deps.colorEnabled ?? !hasFlag(argv, "--no-color");
  const styles = createStyles(colorEnabled);

  if (hasFlag(argv, "--help") || hasFlag(argv, "-h") || argv[0] === "help") {
    printHelp(stdout);
    return EXIT_CODES.ok;
  }
  if (hasFlag(argv, "--version") || hasFlag(argv, "-v")) {
    writeLine(stdout, VERSION);
    return EXIT_CODES.ok;
  }

  try {
    const format = parseFormat(argv);
    const cap = parseCap(parseArg(argv, "--cap="));
    const threshold = parseThreshold(parseArg(argv, "--threshold="));
    const direction = parseDirection(parseArg(argv, "--direction="));
    const cooldownMinutes = parseCooldown(parseArg(argv, "--cooldown-minutes="));
    const label = parseArg(argv, "--label=");
    const stateFile = parseArg(argv, "--state-file=");
    const webhook = parseArg(argv, "--webhook=");
    const valueArg = parseArg(argv, "--value=");
    const jsonPath = parseArg(argv, "--json-path=");
    const stdinData =
      deps.stdinData !== undefined
        ? deps.stdinData
        : valueArg !== undefined || !stdinHasData()
        ? ""
        : await readStdin();

    const parsedInput = parseNumericInput({
      jsonPath,
      stdin: stdinData,
      value: valueArg,
    });

    const result = await runThresholdHook({
      cap,
      cooldownMinutes,
      cwd: deps.cwd,
      direction,
      fetch: deps.fetch,
      label,
      now: deps.now,
      stateFile,
      threshold,
      value: parsedInput.value,
      webhook,
    });

    const payload = {
      alertReason: result.alertReason ?? null,
      alertSent: result.alertSent,
      breached: result.breached,
      cap: result.cap,
      command: result.command,
      cooldownMinutes: result.cooldownMinutes,
      deliveryStatus: result.deliveryStatus,
      direction: result.direction,
      inputSource: parsedInput.inputSource,
      jsonPath: parsedInput.jsonPath ?? null,
      label: result.label ?? null,
      ok: result.ok,
      schemaVersion: JSON_SCHEMA_VERSION,
      stateFile: result.stateFile,
      status: result.status,
      thresholdRatio: result.threshold,
      thresholdValue: result.thresholdValue,
      value: result.value,
      webhookError: result.webhookError ?? null,
    };

    if (format === "json") {
      writeJson(stdout, payload);
    } else {
      writeLine(stdout, `Status:         ${colorizeStatus(result.status, styles)}`);
      if (label) writeLine(stdout, `Label:          ${label}`);
      writeLine(stdout, `Value:          ${formatNumber(result.value)}`);
      writeLine(
        stdout,
        `Threshold:      ${formatComparison(result.direction, result.thresholdValue)} (${formatPercent(
          result.threshold
        )} of ${formatNumber(result.cap)})`
      );
      writeLine(stdout, `Direction:      ${result.direction}`);
      writeLine(stdout, `Delivery:       ${result.deliveryStatus}`);
      writeLine(stdout, `State file:     ${result.stateFile}`);
      if (result.status === "recovered") {
        writeLine(stdout, describeRecovery(result.direction));
      } else {
        writeLine(stdout, describeThreshold(result.direction, result.thresholdValue));
      }
      if (result.deliveryStatus === "failed" && result.webhookError) {
        writeError(stderr, `Webhook failed: ${result.webhookError}`);
      }
    }

    if (result.deliveryStatus === "failed") return EXIT_CODES.webhook;
    if (result.breached) return EXIT_CODES.breached;
    return EXIT_CODES.ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const format = hasFlag(argv, "--format=json") || parseArg(argv, "--format=") === "json" ? "json" : "table";
    if (format === "json") {
      writeJson(stdout, {
        command: "threshold-hook",
        message,
        ok: false,
        schemaVersion: JSON_SCHEMA_VERSION,
        status: "config-failure",
      });
    } else {
      writeError(stderr, message);
    }
    return EXIT_CODES.config;
  }
}

async function main() {
  try {
    const exitCode = await runCli(process.argv.slice(2));
    process.exit(exitCode);
  } catch (error) {
    writeError(process.stderr, error instanceof Error ? error.message : String(error));
    process.exit(EXIT_CODES.internal);
  }
}

if (directInvocation()) {
  void main();
}
