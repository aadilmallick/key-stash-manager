import { ProviderAdapter } from "./types";

interface OpenRouterKeyResponse {
  data?: {
    usage?: number;
    limit?: number | null;
    limit_remaining?: number | null;
  };
}

export const openrouterAdapter: ProviderAdapter = {
  id: "openrouter",
  label: "OpenRouter",
  keyLabel: "API key",
  keyPlaceholder: "sk-or-v1-...",
  setupSteps: [
    {
      text: "Go to OpenRouter → Settings → Keys and create (or copy) an API key.",
      href: "https://openrouter.ai/settings/keys",
    },
    {
      text: "Any standard OpenRouter key works - no special admin permissions needed.",
    },
  ],
  buildProxyParams() {
    return undefined;
  },
  parseSnapshot(raw: unknown) {
    const body = raw as OpenRouterKeyResponse;
    if (!body || typeof body !== "object" || !body.data || typeof body.data.usage !== "number") {
      throw new Error("Unexpected response from OpenRouter's key endpoint.");
    }
    const { usage, limit, limit_remaining } = body.data;
    return {
      provider: "openrouter" as const,
      spendUsd: usage,
      limitUsd: typeof limit === "number" ? limit : null,
      remainingUsd: typeof limit_remaining === "number" ? limit_remaining : null,
      periodLabel: "Lifetime (this key)",
    };
  },
};
