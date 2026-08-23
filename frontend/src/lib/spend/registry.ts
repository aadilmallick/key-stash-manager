import { ProviderAdapter, ProviderId } from "./types";
import { openaiAdapter } from "./openaiAdapter";
import { openrouterAdapter } from "./openrouterAdapter";

export const PROVIDER_ADAPTERS: Record<ProviderId, ProviderAdapter> = {
  openai: openaiAdapter,
  openrouter: openrouterAdapter,
};

export function listProviderAdapters(): ProviderAdapter[] {
  return Object.values(PROVIDER_ADAPTERS);
}

export function getProviderAdapter(id: ProviderId): ProviderAdapter {
  return PROVIDER_ADAPTERS[id];
}
