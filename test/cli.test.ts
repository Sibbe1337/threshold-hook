import { symlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { isDirectInvocation, runCli } from "../src/cli.js";
import { MemoryStream, makeTempDir } from "./helpers.js";

describe("runCli", () => {
  it("emits stable JSON output", async () => {
    const stdout = new MemoryStream();
    const stderr = new MemoryStream();
    const exitCode = await runCli(
      ["--value=92", "--cap=100", "--threshold=0.8", "--format=json", "--label=queue depth"],
      {
        cwd: makeTempDir("threshold-hook-cli"),
        stdout,
        stderr,
      }
    );

    const json = JSON.parse(stdout.output);
    expect(exitCode).toBe(2);
    expect(json.schemaVersion).toBe(1);
    expect(json.command).toBe("threshold-hook");
    expect(json.status).toBe("threshold-crossed");
    expect(json.deliveryStatus).toBe("not-configured");
    expect(json.label).toBe("queue depth");
    expect(stderr.output).toBe("");
  });

  it("accepts stdin JSON plus --json-path", async () => {
    const stdout = new MemoryStream();
    const exitCode = await runCli(
      ["--json-path=data.total", "--cap=100", "--threshold=0.8", "--format=json"],
      {
        cwd: makeTempDir("threshold-hook-json"),
        stdinData: '{"data":{"total":72}}',
        stderr: new MemoryStream(),
        stdout,
      }
    );

    const json = JSON.parse(stdout.output);
    expect(exitCode).toBe(0);
    expect(json.value).toBe(72);
    expect(json.inputSource).toBe("stdin-json");
  });

  it("returns config/input errors as exit code 1", async () => {
    const stdout = new MemoryStream();
    const exitCode = await runCli(["--cap=100", "--threshold=0.8", "--format=json"], {
      stdout,
      stderr: new MemoryStream(),
    });

    const json = JSON.parse(stdout.output);
    expect(exitCode).toBe(1);
    expect(json.ok).toBe(false);
    expect(json.status).toBe("config-failure");
  });

  it("returns webhook failures as exit code 3", async () => {
    const exitCode = await runCli(
      [
        "--value=92",
        "--cap=100",
        "--threshold=0.8",
        "--webhook=https://hooks.slack.com/services/T/B/C",
      ],
      {
        cwd: makeTempDir("threshold-hook-webhook-fail"),
        fetch: (async () => new Response("nope", { status: 500 })) as typeof fetch,
        stderr: new MemoryStream(),
        stdout: new MemoryStream(),
      }
    );

    expect(exitCode).toBe(3);
  });

  it("treats a symlinked bin path as a direct invocation", () => {
    const cwd = makeTempDir("threshold-hook-cli-symlink");
    const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
    const symlinkPath = `${cwd}/threshold-hook`;
    symlinkSync(cliPath, symlinkPath);

    expect(isDirectInvocation(new URL("../src/cli.ts", import.meta.url).href, symlinkPath)).toBe(true);
  });
});
