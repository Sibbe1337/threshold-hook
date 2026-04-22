export const JSON_SCHEMA_VERSION = 1;
export const DEFAULT_STATE_FILE = ".threshold-hook.state.json";
export const DEFAULT_COOLDOWN_MINUTES = 60;

export const EXIT_CODES = {
  ok: 0,
  config: 1,
  breached: 2,
  webhook: 3,
  internal: 10,
} as const;

export type Direction = "above" | "below";
export type OutputFormat = "table" | "json";
export type InputSource = "flag" | "stdin" | "stdin-json";
export type ThresholdStatus =
  | "normal"
  | "threshold-crossed"
  | "threshold-breached"
  | "threshold-reminder"
  | "recovered";
export type AlertReason = "crossed" | "reminder" | "recovered";
export type DeliveryStatus =
  | "failed"
  | "not-configured"
  | "not-needed"
  | "sent"
  | "suppressed";
