import { describe, expect, it } from "vitest";
import {
  buildDotenvContent,
  buildExportContent,
  formatDotenvLine,
  formatExportLine,
  isValidSecretName,
} from "./secretExportFormat";

// Minimal reverse parser, only for proving formatDotenvLine/formatExportLine
// round-trip correctly - not part of the app's actual .env import path.
function parseLine(line: string): { name: string; value: string } {
  const withoutExport = line.startsWith("export ") ? line.slice(7) : line;
  const eq = withoutExport.indexOf("=");
  const name = withoutExport.slice(0, eq);
  let raw = withoutExport.slice(eq + 1);
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    raw = raw
      .slice(1, -1)
      .replace(/\\(\\|"|\$|`|r|n)/g, (_match, ch: string) => {
        switch (ch) {
          case "\\":
            return "\\";
          case '"':
            return '"';
          case "$":
            return "$";
          case "`":
            return "`";
          case "r":
            return "\r";
          case "n":
            return "\n";
          default:
            return ch;
        }
      });
  }
  return { name, value: raw };
}

describe("isValidSecretName", () => {
  it("accepts identifier-like names", () => {
    expect(isValidSecretName("OPENAI_API_KEY")).toBe(true);
    expect(isValidSecretName("_secret1")).toBe(true);
  });

  it("rejects names with spaces or leading digits", () => {
    expect(isValidSecretName("my key")).toBe(false);
    expect(isValidSecretName("1KEY")).toBe(false);
    expect(isValidSecretName("")).toBe(false);
  });
});

describe("formatDotenvLine / formatExportLine", () => {
  it("throws on an invalid name", () => {
    expect(() => formatDotenvLine("bad name", "x")).toThrow();
    expect(() => formatExportLine("bad name", "x")).toThrow();
  });

  it("leaves plain values bare", () => {
    expect(formatDotenvLine("KEY", "abc123")).toBe("KEY=abc123");
    expect(formatExportLine("KEY", "abc123")).toBe("export KEY=abc123");
  });

  it("quotes values containing spaces", () => {
    expect(formatDotenvLine("KEY", "hello world")).toBe(
      'KEY="hello world"',
    );
  });

  it("quotes and escapes an empty value", () => {
    expect(formatDotenvLine("KEY", "")).toBe('KEY=""');
  });

  const trickyValues = [
    "hello world",
    'has "double quotes"',
    "has $VAR expansion",
    "has `backticks`",
    "has\\backslash",
    "has#hash",
    "has'single'quotes",
    "line1\nline2",
    "carriage\rreturn",
    '$(command) "quoted" \\ mix\nwith\nnewlines',
  ];

  it.each(trickyValues)(
    "round-trips %j through formatDotenvLine + parseLine",
    (value) => {
      const line = formatDotenvLine("KEY", value);
      const parsed = parseLine(line);
      expect(parsed.name).toBe("KEY");
      expect(parsed.value).toBe(value);
    },
  );

  it.each(trickyValues)(
    "round-trips %j through formatExportLine + parseLine",
    (value) => {
      const line = formatExportLine("KEY", value);
      const parsed = parseLine(line);
      expect(parsed.name).toBe("KEY");
      expect(parsed.value).toBe(value);
    },
  );
});

describe("buildDotenvContent / buildExportContent", () => {
  it("joins multiple pairs with newlines", () => {
    const pairs = [
      { name: "A", value: "1" },
      { name: "B", value: "two words" },
    ];
    expect(buildDotenvContent(pairs)).toBe('A=1\nB="two words"');
    expect(buildExportContent(pairs)).toBe(
      'export A=1\nexport B="two words"',
    );
  });
});
