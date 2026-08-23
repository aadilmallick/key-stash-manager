// Shared stateless proxy logic for the API Spend feature, used by both the
// Netlify Function (frontend/netlify/functions/proxy-spend.mts) and the
// Express route (server.js, for Docker/local self-hosting). Deliberately
// dependency-free CommonJS: the root package.json uses zod v4 while
// frontend/package.json uses zod v3, and this .cjs file needs to load
// cleanly regardless of which caller's node_modules resolves it.
//
// Security model: the client never supplies a target URL or path - only a
// `provider` id. The two upstream endpoints below are the ONLY URLs this
// proxy will ever fetch, which is what actually prevents this from being an
// open SSRF proxy (a raw client-supplied-URL pass-through would not be
// safe). Nothing is logged: no apiKey, no headers, no request/response
// bodies.

function startOfCurrentUtcMonthSeconds() {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0);
  return Math.floor(start / 1000);
}

const PROVIDER_CONFIGS = {
  openai: {
    buildRequest: (apiKey, params) => {
      const startTime =
        (params && params.startTime) || startOfCurrentUtcMonthSeconds();
      const endTime = (params && params.endTime) || Math.floor(Date.now() / 1000);
      const url =
        "https://api.openai.com/v1/organization/costs" +
        `?start_time=${encodeURIComponent(startTime)}` +
        `&end_time=${encodeURIComponent(endTime)}` +
        "&bucket_width=1d&limit=31";
      return { url, headers: { Authorization: `Bearer ${apiKey}` } };
    },
  },
  openrouter: {
    buildRequest: (apiKey) => ({
      url: "https://openrouter.ai/api/v1/auth/key",
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
  },
};

const PROVIDER_IDS = Object.keys(PROVIDER_CONFIGS);

function validateRequestBody(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const { provider, apiKey, params } = body;
  if (typeof provider !== "string" || !PROVIDER_CONFIGS[provider]) {
    return {
      ok: false,
      error: `provider must be one of: ${PROVIDER_IDS.join(", ")}`,
    };
  }
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    return { ok: false, error: "apiKey must be a non-empty string." };
  }
  if (params !== undefined) {
    if (
      typeof params !== "object" ||
      params === null ||
      Array.isArray(params) ||
      Object.values(params).some((v) => typeof v !== "number")
    ) {
      return {
        ok: false,
        error: "params, if present, must be a plain object of numbers.",
      };
    }
  }
  return { ok: true, value: { provider, apiKey, params } };
}

async function handleSpendProxyRequest(body) {
  const validated = validateRequestBody(body);
  if (!validated.ok) {
    return { status: 400, body: { error: validated.error } };
  }

  const { provider, apiKey, params } = validated.value;
  const config = PROVIDER_CONFIGS[provider];
  const { url, headers } = config.buildRequest(apiKey, params);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const upstream = await fetch(url, { headers, signal: controller.signal });
    const text = await upstream.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // upstream didn't return JSON - fall through, json stays null
    }

    if (!upstream.ok) {
      return {
        status: 502,
        body: {
          error: "Provider request failed",
          status: upstream.status,
          body: json !== null ? json : text.slice(0, 2000),
        },
      };
    }

    return { status: 200, body: { provider, raw: json } };
  } catch (error) {
    return { status: 500, body: { error: "Proxy request failed" } };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { handleSpendProxyRequest, validateRequestBody, PROVIDER_IDS };
