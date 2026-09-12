// Shell-safe serialization for exporting secrets as .env / `export KEY=VALUE`
// lines. Values containing spaces, quotes, `#`, `$`, backslashes, or
// newlines are wrapped in double quotes with shell-style escaping so the
// resulting lines round-trip correctly through both a dotenv parser and a
// POSIX shell `source`/`.`.

const VALID_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Characters that make a bare (unquoted) value unsafe to round-trip: any
// whitespace, `#` (starts a comment), quotes, `\`, `$` (variable expansion),
// or backtick (command substitution).
const NEEDS_QUOTING_RE = /[\s"'#$\\`]/;

export function isValidSecretName(name: string): boolean {
  return VALID_NAME_RE.test(name);
}

// Escapes a value for placement inside a double-quoted shell string:
// backslash first (so later escapes aren't double-escaped), then the
// characters that are special to POSIX shell double-quoting (`"`, `$`,
// backtick), then control characters that would otherwise break a
// single-line KEY=VALUE format.
function escapeForDoubleQuotes(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "\\$")
    .replace(/`/g, "\\`")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function formatValue(value: string): string {
  if (value === "" || NEEDS_QUOTING_RE.test(value) || /[\r\n]/.test(value)) {
    return `"${escapeForDoubleQuotes(value)}"`;
  }
  return value;
}

function assertValidName(name: string): void {
  if (!isValidSecretName(name)) {
    throw new Error(
      `"${name}" is not a valid environment variable name (must match ${VALID_NAME_RE})`,
    );
  }
}

export function formatDotenvLine(name: string, value: string): string {
  assertValidName(name);
  return `${name}=${formatValue(value)}`;
}

export function formatExportLine(name: string, value: string): string {
  assertValidName(name);
  return `export ${name}=${formatValue(value)}`;
}

export function buildDotenvContent(
  pairs: { name: string; value: string }[],
): string {
  return pairs.map((p) => formatDotenvLine(p.name, p.value)).join("\n");
}

export function buildExportContent(
  pairs: { name: string; value: string }[],
): string {
  return pairs.map((p) => formatExportLine(p.name, p.value)).join("\n");
}
