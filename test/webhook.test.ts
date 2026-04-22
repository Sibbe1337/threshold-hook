import { describe, expect, it } from "vitest";

import { formatAlertMessage, postAlert } from "../src/webhook.js";

describe("formatAlertMessage", () => {
  it("formats a crossing alert", () => {
    const message = formatAlertMessage({
      cap: 100,
      direction: "above",
      status: "threshold-crossed",
      threshold: 0.8,
      thresholdValue: 80,
      value: 91,
    });

    expect(message).toContain("Crossed above threshold");
    expect(message).toContain("Value: 91");
    expect(message).toContain(">= 80");
  });

  it("formats a recovery alert for below-direction checks", () => {
    const message = formatAlertMessage({
      cap: 50,
      direction: "below",
      status: "recovered",
      threshold: 0.2,
      thresholdValue: 10,
      value: 12,
    });

    expect(message).toContain("Recovered above threshold");
  });
});

describe("postAlert", () => {
  it("uses text for Slack", async () => {
    let body = "";
    const result = await postAlert(
      {
        fetch: (async (_url, init) => {
          body = String(init?.body ?? "");
          return new Response("ok", { status: 200 });
        }) as typeof fetch,
        url: "https://hooks.slack.com/services/T/B/C",
      },
      {
        cap: 100,
        direction: "above",
        status: "threshold-crossed",
        threshold: 0.8,
        thresholdValue: 80,
        value: 90,
      }
    );

    expect(result.ok).toBe(true);
    expect(body).toContain('"text"');
    expect(body).not.toContain('"content"');
  });

  it("uses content for Discord", async () => {
    let body = "";
    const result = await postAlert(
      {
        fetch: (async (_url, init) => {
          body = String(init?.body ?? "");
          return new Response("ok", { status: 200 });
        }) as typeof fetch,
        url: "https://discord.com/api/webhooks/1/2",
      },
      {
        cap: 100,
        direction: "above",
        status: "threshold-reminder",
        threshold: 0.8,
        thresholdValue: 80,
        value: 90,
      }
    );

    expect(result.ok).toBe(true);
    expect(body).toContain('"content"');
  });

  it("includes structured fallback fields for generic webhooks", async () => {
    let body = "";
    const result = await postAlert(
      {
        fetch: (async (_url, init) => {
          body = String(init?.body ?? "");
          return new Response("ok", { status: 200 });
        }) as typeof fetch,
        url: "https://example.com/hooks/threshold",
      },
      {
        cap: 100,
        direction: "above",
        label: "queue depth",
        status: "threshold-crossed",
        threshold: 0.8,
        thresholdValue: 80,
        value: 90,
      }
    );

    expect(result.ok).toBe(true);
    expect(body).toContain('"event":"threshold-hook"');
    expect(body).toContain('"label":"queue depth"');
  });
});
