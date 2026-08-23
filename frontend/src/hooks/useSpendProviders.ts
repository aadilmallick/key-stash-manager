import { useLiveQuery } from "@tanstack/react-db";
import { useDbCollections } from "./useDb";
import { decryptValue, encryptValue } from "@/lib/crypto";
import { SpendProviderRow } from "@/lib/db/schema";
import { ProviderId } from "@/lib/spend/types";
import { getProviderAdapter } from "@/lib/spend/registry";
import { fetchProviderSpend } from "@/lib/spend/proxyClient";

export function useSpendProviders(): SpendProviderRow[] {
  const { collections } = useDbCollections();
  const { data } = useLiveQuery((q) =>
    q.from({ spendProviders: collections.spendProviders })
  );
  return (data ?? []) as unknown as SpendProviderRow[];
}

export function useSpendProviderActions() {
  const { collections, vaultKey } = useDbCollections();

  const refreshProvider = async (id: string) => {
    const row = collections.spendProviders.get(id) as
      | SpendProviderRow
      | undefined;
    if (!row) return;

    const adapter = getProviderAdapter(row.provider as ProviderId);
    try {
      // Decrypted only in this local scope, for the duration of the
      // outbound proxy call - never stored in component state.
      const apiKey = await decryptValue(row.encryptedApiKey, vaultKey);
      const snapshot = await fetchProviderSpend(adapter, apiKey);
      collections.spendProviders.update(id, (draft) => {
        draft.lastSnapshot = JSON.stringify(snapshot);
        draft.lastError = undefined;
        draft.updatedAt = new Date().toISOString();
      });
    } catch (error) {
      // Leave the previous lastSnapshot in place - graceful degrade,
      // not a wipe of the last-known-good numbers.
      collections.spendProviders.update(id, (draft) => {
        draft.lastError =
          error instanceof Error ? error.message : "Failed to refresh spend.";
        draft.updatedAt = new Date().toISOString();
      });
    }
  };

  const addProvider = async (input: {
    provider: ProviderId;
    apiKey: string;
    label?: string;
    budgetUsd?: number;
  }) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const encryptedApiKey = await encryptValue(input.apiKey, vaultKey);
    collections.spendProviders.insert({
      id,
      provider: input.provider,
      label: input.label,
      encryptedApiKey,
      budgetUsd: input.budgetUsd,
      createdAt: now,
      updatedAt: now,
    });
    await refreshProvider(id);
    return id;
  };

  const updateBudget = (id: string, budgetUsd: number | undefined) => {
    collections.spendProviders.update(id, (draft) => {
      draft.budgetUsd = budgetUsd;
      draft.updatedAt = new Date().toISOString();
    });
  };

  const deleteProvider = (id: string) => {
    collections.spendProviders.delete([id]);
  };

  return { addProvider, refreshProvider, updateBudget, deleteProvider };
}
