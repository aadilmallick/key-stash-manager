import { ProviderAdapter } from "./types";

interface OpenAICostsResponse {
  data?: Array<{
    results?: Array<{
      amount?: { value?: number };
    }>;
  }>;
}

function startOfCurrentUtcMonthSeconds(): number {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0);
  return Math.floor(start / 1000);
}

export const openaiAdapter: ProviderAdapter = {
  id: "openai",
  label: "OpenAI",
  keyLabel: "Admin API key",
  keyPlaceholder: "sk-admin-...",
  setupSteps: [
    {
      text: "Go to platform.openai.com → Settings → Organization → Admin keys and create a new key.",
      href: "https://platform.openai.com/settings/organization/admin-keys",
    },
    {
      text: "This must be an Admin key, not a regular project API key - project keys can't read organization costs.",
    },
  ],
  buildProxyParams() {
    return {
      startTime: startOfCurrentUtcMonthSeconds(),
      endTime: Math.floor(Date.now() / 1000),
    };
  },
  parseSnapshot(raw: unknown) {
    const body = raw as OpenAICostsResponse;
    if (!body || typeof body !== "object" || !Array.isArray(body.data)) {
      throw new Error("Unexpected response from OpenAI's costs endpoint.");
    }
    let spendUsd = 0;
    for (const bucket of body.data) {
      for (const result of bucket.results ?? []) {
        spendUsd += result.amount?.value ?? 0;
      }
    }
    return {
      provider: "openai" as const,
      spendUsd,
      limitUsd: null,
      remainingUsd: null,
      periodLabel: "This month (UTC)",
    };
  },
};
