import type { Direction, ThresholdStatus } from "./constants.js";

export function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(4).replace(/\.?0+$/, "");
}

export function formatPercent(value: number): string {
  const pct = value * 100;
  const digits = Number.isInteger(pct) ? 0 : Number.isInteger(pct * 10) ? 1 : 2;
  return `${pct.toFixed(digits)}%`;
}

export function formatComparison(direction: Direction, thresholdValue: number): string {
  return `${direction === "above" ? ">=" : "<="} ${formatNumber(thresholdValue)}`;
}

export function describeRecovery(direction: Direction): string {
  return direction === "above"
    ? "Recovered below the threshold."
    : "Recovered above the threshold.";
}

export function describeThreshold(direction: Direction, thresholdValue: number): string {
  return direction === "above"
    ? `Breach when value is ${formatComparison(direction, thresholdValue)}.`
    : `Breach when value is ${formatComparison(direction, thresholdValue)}.`;
}

function colorize(enabled: boolean, value: string, code: string): string {
  if (!enabled) return value;
  return `\x1b[${code}m${value}\x1b[0m`;
}

export function createStyles(colorEnabled: boolean) {
  return {
    dim: (value: string) => colorize(colorEnabled, value, "2"),
    green: (value: string) => colorize(colorEnabled, value, "32"),
    red: (value: string) => colorize(colorEnabled, value, "31"),
    yellow: (value: string) => colorize(colorEnabled, value, "33"),
  };
}

export function colorizeStatus(
  status: ThresholdStatus,
  styles: ReturnType<typeof createStyles>
): string {
  if (status === "normal" || status === "recovered") return styles.green(status);
  if (status === "threshold-crossed") return styles.red(status);
  return styles.yellow(status);
}
