import { resolve } from "node:path";

import {
  DEFAULT_STATE_FILE,
  JSON_SCHEMA_VERSION,
  type DeliveryStatus,
  type Direction,
  type ThresholdStatus,
} from "./constants.js";
import { evaluateThreshold, type ThresholdHookState } from "./threshold.js";
import { loadState, saveState } from "./state.js";
import { postAlert, type WebhookResult } from "./webhook.js";

export interface RunThresholdHookOptions {
  cap: number;
  cooldownMinutes?: number;
  cwd?: string;
  direction?: Direction;
  fetch?: typeof globalThis.fetch;
  label?: string;
  now?: Date;
  stateFile?: string;
  threshold: number;
  value: number;
  webhook?: string;
}

export interface RunThresholdHookResult {
  alertReason?: "crossed" | "recovered" | "reminder";
  alertSent: boolean;
  breached: boolean;
  cap: number;
  command: "threshold-hook";
  cooldownMinutes: number;
  deliveryStatus: DeliveryStatus;
  direction: Direction;
  label?: string;
  ok: boolean;
  previousBreached: boolean;
  schemaVersion: number;
  state: ThresholdHookState;
  stateFile: string;
  status: ThresholdStatus;
  threshold: number;
  thresholdValue: number;
  value: number;
  webhookError?: string;
  webhookResult?: WebhookResult;
}

export async function runThresholdHook(
  options: RunThresholdHookOptions
): Promise<RunThresholdHookResult> {
  const stateFile = resolve(options.cwd ?? process.cwd(), options.stateFile ?? DEFAULT_STATE_FILE);
  const previousState = loadState(stateFile);
  const evaluation = evaluateThreshold({
    cap: options.cap,
    cooldownMinutes: options.cooldownMinutes,
    direction: options.direction,
    now: options.now,
    previousState,
    threshold: options.threshold,
    value: options.value,
  });

  let deliveryStatus: DeliveryStatus = evaluation.shouldAlert
    ? options.webhook
      ? "sent"
      : "not-configured"
    : evaluation.breached
    ? "suppressed"
    : "not-needed";
  let alertSent = false;
  let webhookResult: WebhookResult | undefined;

  if (evaluation.shouldAlert && options.webhook) {
    webhookResult = await postAlert(
      { fetch: options.fetch, url: options.webhook },
      {
        cap: options.cap,
        direction: evaluation.direction,
        label: options.label,
        reason: evaluation.alertReason,
        status: evaluation.status,
        threshold: options.threshold,
        thresholdValue: evaluation.thresholdValue,
        value: options.value,
      }
    );

    if (!webhookResult.ok) {
      deliveryStatus = "failed";
      return {
        alertReason: evaluation.alertReason,
        alertSent,
        breached: evaluation.breached,
        cap: options.cap,
        command: "threshold-hook",
        cooldownMinutes: evaluation.cooldownMinutes,
        deliveryStatus,
        direction: evaluation.direction,
        label: options.label,
        ok: false,
        previousBreached: evaluation.previousBreached,
        schemaVersion: JSON_SCHEMA_VERSION,
        state: evaluation.nextState,
        stateFile,
        status: evaluation.status,
        threshold: options.threshold,
        thresholdValue: evaluation.thresholdValue,
        value: options.value,
        webhookError: webhookResult.error,
        webhookResult,
      };
    }

    alertSent = true;
  }

  saveState(stateFile, evaluation.nextState);

  return {
    alertReason: evaluation.alertReason,
    alertSent,
    breached: evaluation.breached,
    cap: options.cap,
    command: "threshold-hook",
    cooldownMinutes: evaluation.cooldownMinutes,
    deliveryStatus,
    direction: evaluation.direction,
    label: options.label,
    ok: true,
    previousBreached: evaluation.previousBreached,
    schemaVersion: JSON_SCHEMA_VERSION,
    state: evaluation.nextState,
    stateFile,
    status: evaluation.status,
    threshold: options.threshold,
    thresholdValue: evaluation.thresholdValue,
    value: options.value,
    webhookError: webhookResult?.error,
    webhookResult,
  };
}
