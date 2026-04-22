import {
  DEFAULT_COOLDOWN_MINUTES,
  JSON_SCHEMA_VERSION,
  type AlertReason,
  type Direction,
  type ThresholdStatus,
} from "./constants.js";

export interface ThresholdConfigSnapshot {
  cap: number;
  direction: Direction;
  threshold: number;
  thresholdValue: number;
}

export interface ThresholdHookState {
  breachActive: boolean;
  config: ThresholdConfigSnapshot;
  lastAlertAt?: string;
  lastAlertReason?: AlertReason;
  lastBreachAt?: string;
  lastEvaluatedAt: string;
  lastRecoveryAt?: string;
  lastValue: number;
  schemaVersion: number;
}

export interface EvaluateThresholdInput {
  cap: number;
  cooldownMinutes?: number;
  direction?: Direction;
  now?: Date;
  previousState?: ThresholdHookState | null;
  threshold: number;
  value: number;
}

export interface EvaluateThresholdResult {
  alertReason?: AlertReason;
  breached: boolean;
  cap: number;
  cooldownMinutes: number;
  direction: Direction;
  nextState: ThresholdHookState;
  previousBreached: boolean;
  shouldAlert: boolean;
  status: ThresholdStatus;
  threshold: number;
  thresholdValue: number;
  value: number;
}

function sameConfig(
  a: ThresholdConfigSnapshot | undefined,
  b: ThresholdConfigSnapshot
): boolean {
  return Boolean(
    a &&
      a.cap === b.cap &&
      a.direction === b.direction &&
      a.threshold === b.threshold &&
      a.thresholdValue === b.thresholdValue
  );
}

function blankState(config: ThresholdConfigSnapshot, now: Date, value: number): ThresholdHookState {
  return {
    breachActive: false,
    config,
    lastEvaluatedAt: now.toISOString(),
    lastValue: value,
    schemaVersion: JSON_SCHEMA_VERSION,
  };
}

export function evaluateThreshold(input: EvaluateThresholdInput): EvaluateThresholdResult {
  const now = input.now ?? new Date();
  const direction = input.direction ?? "above";
  const cooldownMinutes = input.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES;
  const thresholdValue = input.cap * input.threshold;

  const config: ThresholdConfigSnapshot = {
    cap: input.cap,
    direction,
    threshold: input.threshold,
    thresholdValue,
  };

  const previous =
    input.previousState &&
    input.previousState.schemaVersion === JSON_SCHEMA_VERSION &&
    sameConfig(input.previousState.config, config)
      ? input.previousState
      : blankState(config, now, input.value);

  const previousBreached = previous.breachActive;
  const breached =
    direction === "above"
      ? input.value >= thresholdValue
      : input.value <= thresholdValue;

  const nextState: ThresholdHookState = {
    ...previous,
    breachActive: breached,
    config,
    lastEvaluatedAt: now.toISOString(),
    lastValue: input.value,
    schemaVersion: JSON_SCHEMA_VERSION,
  };

  if (!breached) {
    if (previousBreached) {
      nextState.lastAlertAt = now.toISOString();
      nextState.lastAlertReason = "recovered";
      nextState.lastRecoveryAt = now.toISOString();
      return {
        alertReason: "recovered",
        breached,
        cap: input.cap,
        cooldownMinutes,
        direction,
        nextState,
        previousBreached,
        shouldAlert: true,
        status: "recovered",
        threshold: input.threshold,
        thresholdValue,
        value: input.value,
      };
    }

    return {
      breached,
      cap: input.cap,
      cooldownMinutes,
      direction,
      nextState,
      previousBreached,
      shouldAlert: false,
      status: "normal",
      threshold: input.threshold,
      thresholdValue,
      value: input.value,
    };
  }

  if (!previousBreached) {
    nextState.lastAlertAt = now.toISOString();
    nextState.lastAlertReason = "crossed";
    nextState.lastBreachAt = now.toISOString();
    return {
      alertReason: "crossed",
      breached,
      cap: input.cap,
      cooldownMinutes,
      direction,
      nextState,
      previousBreached,
      shouldAlert: true,
      status: "threshold-crossed",
      threshold: input.threshold,
      thresholdValue,
      value: input.value,
    };
  }

  const cooldownMs = cooldownMinutes * 60_000;
  const lastAlertAt = previous.lastAlertAt ? Date.parse(previous.lastAlertAt) : Number.NaN;
  const cooldownExpired =
    !Number.isFinite(lastAlertAt) || now.getTime() - lastAlertAt >= cooldownMs;

  if (cooldownExpired) {
    nextState.lastAlertAt = now.toISOString();
    nextState.lastAlertReason = "reminder";
    return {
      alertReason: "reminder",
      breached,
      cap: input.cap,
      cooldownMinutes,
      direction,
      nextState,
      previousBreached,
      shouldAlert: true,
      status: "threshold-reminder",
      threshold: input.threshold,
      thresholdValue,
      value: input.value,
    };
  }

  return {
    breached,
    cap: input.cap,
    cooldownMinutes,
    direction,
    nextState,
    previousBreached,
    shouldAlert: false,
    status: "threshold-breached",
    threshold: input.threshold,
    thresholdValue,
    value: input.value,
  };
}
