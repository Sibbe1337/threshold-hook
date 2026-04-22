import type { AlertReason, Direction, ThresholdStatus } from "./constants.js";
import { formatComparison, formatNumber, formatPercent } from "./format.js";

export interface AlertPayload {
  cap: number;
  direction: Direction;
  label?: string;
  reason?: AlertReason;
  status: ThresholdStatus;
  threshold: number;
  thresholdValue: number;
  value: number;
}

export interface WebhookTarget {
  fetch?: typeof globalThis.fetch;
  url: string;
}

export interface WebhookResult {
  error?: string;
  ok: boolean;
  status?: number;
}

function detectProvider(url: string): "discord" | "generic" | "slack" {
  if (url.includes("hooks.slack.com")) return "slack";
  if (url.includes("discord.com/api/webhooks") || url.includes("discordapp.com/api/webhooks")) {
    return "discord";
  }
  return "generic";
}

function statusLine(payload: AlertPayload): string {
  if (payload.status === "threshold-crossed") {
    return payload.direction === "above"
      ? "Crossed above threshold."
      : "Dropped below threshold.";
  }
  if (payload.status === "threshold-reminder") {
    return payload.direction === "above"
      ? "Still above threshold after cooldown."
      : "Still below threshold after cooldown.";
  }
  if (payload.status === "recovered") {
    return payload.direction === "above"
      ? "Recovered below threshold."
      : "Recovered above threshold.";
  }
  return payload.reason || payload.status;
}

export function formatAlertMessage(payload: AlertPayload): string {
  const label = payload.label ? ` (${payload.label})` : "";
  return [
    `threshold-hook${label}`,
    statusLine(payload),
    `Value: ${formatNumber(payload.value)}`,
    `Threshold: ${formatComparison(payload.direction, payload.thresholdValue)} (${formatPercent(
      payload.threshold
    )} of ${formatNumber(payload.cap)})`,
  ].join("\n");
}

export async function postAlert(
  target: WebhookTarget,
  payload: AlertPayload
): Promise<WebhookResult> {
  const { fetch: fetchImpl = globalThis.fetch, url } = target;
  if (!url) return { error: "webhook url is required", ok: false };
  if (!fetchImpl) return { error: "fetch is not available", ok: false };

  const text = formatAlertMessage(payload);
  const provider = detectProvider(url);
  const body =
    provider === "slack"
      ? { text }
      : provider === "discord"
      ? { content: text }
      : {
          cap: payload.cap,
          content: text,
          direction: payload.direction,
          event: "threshold-hook",
          label: payload.label || null,
          reason: payload.reason || null,
          status: payload.status,
          text,
          threshold: payload.threshold,
          thresholdValue: payload.thresholdValue,
          value: payload.value,
        };

  try {
    const response = await fetchImpl(url, {
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      return {
        error: `${response.status}: ${errBody.slice(0, 200)}`,
        ok: false,
        status: response.status,
      };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      ok: false,
    };
  }
}
