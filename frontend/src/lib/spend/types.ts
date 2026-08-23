export type ProviderId = "openai" | "openrouter";

// OpenAI reports "spend so far this calendar month" while OpenRouter
// reports "lifetime spend on this key" - these are fundamentally
// different windows and must not be conflated in the UI, hence the
// explicit periodLabel on every snapshot.
export interface SpendSnapshot {
  provider: ProviderId;
  spendUsd: number;
  limitUsd: number | null;
  remainingUsd: number | null;
  periodLabel: string;
  fetchedAt: string;
}

export interface ProviderSetupStep {
  text: string;
  href?: string;
}

export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  keyLabel: string;
  keyPlaceholder: string;
  setupSteps: ProviderSetupStep[];
  // Query params to send to the proxy for this provider, or undefined if
  // the request needs none.
  buildProxyParams(): Record<string, number> | undefined;
  // Throws a descriptive Error if `raw` doesn't match the expected shape.
  parseSnapshot(raw: unknown): Omit<SpendSnapshot, "fetchedAt">;
}
