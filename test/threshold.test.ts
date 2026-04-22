import { describe, expect, it } from "vitest";

import { evaluateThreshold } from "../src/threshold.js";

describe("evaluateThreshold", () => {
  it("alerts on a fresh threshold crossing", () => {
    const result = evaluateThreshold({
      cap: 100,
      now: new Date(Date.UTC(2026, 3, 22, 10, 0, 0)),
      threshold: 0.8,
      value: 85,
    });

    expect(result.breached).toBe(true);
    expect(result.shouldAlert).toBe(true);
    expect(result.status).toBe("threshold-crossed");
    expect(result.alertReason).toBe("crossed");
  });

  it("suppresses alerts during cooldown and reminds after cooldown", () => {
    const first = evaluateThreshold({
      cap: 100,
      cooldownMinutes: 60,
      now: new Date(Date.UTC(2026, 3, 22, 10, 0, 0)),
      threshold: 0.8,
      value: 85,
    });

    const suppressed = evaluateThreshold({
      cap: 100,
      cooldownMinutes: 60,
      now: new Date(Date.UTC(2026, 3, 22, 10, 30, 0)),
      previousState: first.nextState,
      threshold: 0.8,
      value: 86,
    });

    const reminder = evaluateThreshold({
      cap: 100,
      cooldownMinutes: 60,
      now: new Date(Date.UTC(2026, 3, 22, 11, 5, 0)),
      previousState: first.nextState,
      threshold: 0.8,
      value: 87,
    });

    expect(suppressed.shouldAlert).toBe(false);
    expect(suppressed.status).toBe("threshold-breached");
    expect(reminder.shouldAlert).toBe(true);
    expect(reminder.status).toBe("threshold-reminder");
    expect(reminder.alertReason).toBe("reminder");
  });

  it("emits recovery when a breached value returns to normal", () => {
    const crossed = evaluateThreshold({
      cap: 100,
      now: new Date(Date.UTC(2026, 3, 22, 10, 0, 0)),
      threshold: 0.8,
      value: 85,
    });

    const recovered = evaluateThreshold({
      cap: 100,
      now: new Date(Date.UTC(2026, 3, 22, 10, 15, 0)),
      previousState: crossed.nextState,
      threshold: 0.8,
      value: 79,
    });

    expect(recovered.breached).toBe(false);
    expect(recovered.shouldAlert).toBe(true);
    expect(recovered.status).toBe("recovered");
    expect(recovered.alertReason).toBe("recovered");
  });

  it("supports below-direction thresholds", () => {
    const result = evaluateThreshold({
      cap: 50,
      direction: "below",
      threshold: 0.2,
      value: 9,
    });

    expect(result.thresholdValue).toBe(10);
    expect(result.breached).toBe(true);
    expect(result.status).toBe("threshold-crossed");
  });
});
