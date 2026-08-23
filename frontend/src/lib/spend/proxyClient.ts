import { ProviderAdapter, SpendSnapshot } from "./types";

export class SpendProxyError extends Error {
  upstreamStatus?: number;

  constructor(message: string, upstreamStatus?: number) {
    super(message);
    this.name = "SpendProxyError";
    this.upstreamStatus = upstreamStatus;
  }
}

// Always calls the same relative path regardless of deployment target:
// Netlify resolves it via a netlify.toml redirect to the Netlify Function,
// the Express/Docker server implements it directly, and plain `vite dev`
// simply has no such route - that 404/network failure is caught below and
// turned into a SpendProxyError instead of an uncaught rejection.
const PROXY_PATH = "/api/proxy-spend";

export async function fetchProviderSpend(
  adapter: ProviderAdapter,
  apiKey: string,
): Promise<SpendSnapshot> {
  let response: Response;
  try {
    response = await fetch(PROXY_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: adapter.id,
        apiKey,
        params: adapter.buildProxyParams(),
      }),
    });
  } catch {
    throw new SpendProxyError(
      "Could not reach the spend proxy - this only works via `netlify dev` or the Docker/Express server, not plain `vite dev`.",
    );
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // fall through - handled by the !response.ok / missing-raw checks below
  }

  if (!response.ok) {
    const message =
      (json as { error?: string } | null)?.error ??
      `Proxy request failed (${response.status}).`;
    throw new SpendProxyError(message, response.status);
  }

  const raw = (json as { raw?: unknown } | null)?.raw;
  const parsed = adapter.parseSnapshot(raw);
  return { ...parsed, fetchedAt: new Date().toISOString() };
}
