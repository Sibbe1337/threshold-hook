import type { InputSource } from "./constants.js";

export interface ParsedInput {
  inputSource: InputSource;
  jsonPath?: string;
  value: number;
}

function asFiniteNumber(value: unknown, message: string): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value.trim())
      : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new Error(message);
  }
  return parsed;
}

export function extractJsonPath(source: unknown, path: string): unknown {
  if (!/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(path)) {
    throw new Error(
      "--json-path must use simple dotted keys such as value, data.total, or metrics.current.usage"
    );
  }

  let current: unknown = source;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      throw new Error(`Path ${path} is invalid for the provided JSON input.`);
    }
    if (!(segment in current)) {
      throw new Error(`Path ${path} was not found in the provided JSON input.`);
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

export function parseNumericInput(options: {
  jsonPath?: string;
  stdin?: string;
  value?: string;
}): ParsedInput {
  const { jsonPath, stdin, value } = options;

  if (value !== undefined) {
    return {
      inputSource: "flag",
      value: asFiniteNumber(value, "--value must be a finite number"),
    };
  }

  const rawStdin = stdin?.trim() || "";
  if (!rawStdin) {
    throw new Error("Pass --value=<number> or pipe a numeric value on stdin.");
  }

  if (jsonPath) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawStdin);
    } catch {
      throw new Error("stdin could not be parsed as JSON. Remove --json-path or provide valid JSON.");
    }

    return {
      inputSource: "stdin-json",
      jsonPath,
      value: asFiniteNumber(
        extractJsonPath(parsedJson, jsonPath),
        `Path ${jsonPath} did not resolve to a finite number.`
      ),
    };
  }

  if (rawStdin.startsWith("{") || rawStdin.startsWith("[")) {
    throw new Error("stdin looks like JSON. Pass --json-path=<path> to extract a numeric field.");
  }

  return {
    inputSource: "stdin",
    value: asFiniteNumber(rawStdin, "stdin must contain a finite number"),
  };
}
