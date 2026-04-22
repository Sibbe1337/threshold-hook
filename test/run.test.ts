import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { runThresholdHook } from "../src/run.js";
import { makeTempDir } from "./helpers.js";

describe("runThresholdHook", () => {
  it("persists state and suppresses repeated alerts during cooldown", async () => {
    const cwd = makeTempDir("threshold-hook-run");
    const webhookCalls: string[] = [];

    const first = await runThresholdHook({
      cap: 100,
      cwd,
      now: new Date(Date.UTC(2026, 3, 22, 10, 0, 0)),
      threshold: 0.8,
      value: 85,
      webhook: "https://hooks.slack.com/services/T/B/C",
      fetch: (async (url) => {
        webhookCalls.push(String(url));
        return new Response("ok", { status: 200 });
      }) as typeof fetch,
    });

    const second = await runThresholdHook({
      cap: 100,
      cwd,
      now: new Date(Date.UTC(2026, 3, 22, 10, 30, 0)),
      threshold: 0.8,
      value: 86,
      webhook: "https://hooks.slack.com/services/T/B/C",
      fetch: (async (url) => {
        webhookCalls.push(String(url));
        return new Response("ok", { status: 200 });
      }) as typeof fetch,
    });

    expect(first.deliveryStatus).toBe("sent");
    expect(second.deliveryStatus).toBe("suppressed");
    expect(webhookCalls).toHaveLength(1);
    expect(existsSync(`${cwd}/.threshold-hook.state.json`)).toBe(true);
  });

  it("does not consume state when webhook delivery fails", async () => {
    const cwd = makeTempDir("threshold-hook-failed-webhook");

    const failed = await runThresholdHook({
      cap: 100,
      cwd,
      now: new Date(Date.UTC(2026, 3, 22, 10, 0, 0)),
      threshold: 0.8,
      value: 90,
      webhook: "https://hooks.slack.com/services/T/B/C",
      fetch: (async () => new Response("nope", { status: 500 })) as typeof fetch,
    });

    expect(failed.deliveryStatus).toBe("failed");
    expect(existsSync(`${cwd}/.threshold-hook.state.json`)).toBe(false);

    const retried = await runThresholdHook({
      cap: 100,
      cwd,
      now: new Date(Date.UTC(2026, 3, 22, 10, 1, 0)),
      threshold: 0.8,
      value: 90,
      webhook: "https://hooks.slack.com/services/T/B/C",
      fetch: (async () => new Response("ok", { status: 200 })) as typeof fetch,
    });

    expect(retried.deliveryStatus).toBe("sent");
    expect(readFileSync(`${cwd}/.threshold-hook.state.json`, "utf8")).toContain('"breachActive": true');
  });
});
