import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { JSON_SCHEMA_VERSION } from "./constants.js";
import type { ThresholdHookState } from "./threshold.js";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("State file is not a valid JSON object.");
  }
  return value as Record<string, unknown>;
}

export function loadState(path: string): ThresholdHookState | null {
  if (!existsSync(path)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`State file ${path} is not valid JSON. Delete it or fix the file contents.`);
  }

  const state = asObject(parsed);
  const config = asObject(state.config);
  if (state.schemaVersion !== JSON_SCHEMA_VERSION) {
    throw new Error(
      `State file ${path} has schemaVersion ${String(
        state.schemaVersion
      )}. Delete it and rerun threshold-hook.`
    );
  }
  if (typeof state.breachActive !== "boolean") {
    throw new Error(`State file ${path} is missing a valid breachActive boolean.`);
  }
  if (typeof state.lastEvaluatedAt !== "string") {
    throw new Error(`State file ${path} is missing lastEvaluatedAt.`);
  }
  if (typeof state.lastValue !== "number") {
    throw new Error(`State file ${path} is missing a valid lastValue number.`);
  }
  if (
    typeof config.cap !== "number" ||
    typeof config.threshold !== "number" ||
    typeof config.thresholdValue !== "number" ||
    (config.direction !== "above" && config.direction !== "below")
  ) {
    throw new Error(`State file ${path} has an invalid config block.`);
  }

  return state as unknown as ThresholdHookState;
}

export function saveState(path: string, state: ThresholdHookState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}
