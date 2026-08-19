import { useEffect, useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { eq } from "@tanstack/db";
import { useDbCollections } from "./useDb";
import { decryptValue, encryptValue } from "@/lib/crypto";
import { SecretRow } from "@/lib/db/schema";

export interface DecryptedSecret extends Omit<SecretRow, "value"> {
  value: string; // plaintext
}

// The `secrets` collection stores ciphertext (fast, synchronous, reactive).
// Decrypting is async, so this hook layers a decrypt pass on top of the
// live-query snapshot, scoped to a single folder's row count to keep it
// cheap. Callers see a brief `loading` state on folder switch that a fully
// synchronous/plaintext store didn't have.
export function useDecryptedSecretsForFolder(folderId: string | undefined): {
  secrets: DecryptedSecret[];
  loading: boolean;
  error: unknown;
} {
  const { collections, vaultKey } = useDbCollections();
  const { data } = useLiveQuery((q) =>
    q
      .from({ secrets: collections.secrets })
      .where(({ secrets }) => eq(secrets.folderId, folderId ?? "")),
  );
  const rows = (data ?? []) as unknown as SecretRow[];
  const signature = rows.map((s) => `${s.id}:${s.value}:${s.updatedAt}`).join(",");

  const [decrypted, setDecrypted] = useState<DecryptedSecret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all(
      rows.map(async (row) => ({
        ...row,
        value: await decryptValue(row.value, vaultKey),
      })),
    ).then(
      (result) => {
        if (cancelled) return;
        result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setDecrypted(result);
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        console.error("Failed to decrypt secrets for folder:", err);
        setError(err);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
    // signature captures the actual row content this effect depends on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, vaultKey]);

  return { secrets: decrypted, loading, error };
}

export function useSecretActions() {
  const { collections, vaultKey } = useDbCollections();

  const addSecret = async (
    folderId: string,
    secret: { name: string; value: string; description?: string },
  ) => {
    const now = new Date().toISOString();
    const siblings = (collections.secrets.toArray as unknown as SecretRow[]).filter(
      (s) => s.folderId === folderId,
    );
    const nextOrder =
      siblings.length > 0
        ? Math.max(...siblings.map((s) => s.order ?? 0)) + 1
        : 0;
    const cipher = await encryptValue(secret.value, vaultKey);
    collections.secrets.insert({
      id: crypto.randomUUID(),
      folderId,
      name: secret.name,
      value: cipher,
      description: secret.description ?? "",
      createdAt: now,
      updatedAt: now,
      order: nextOrder,
    });
  };

  const updateSecret = async (
    secretId: string,
    updates: { name?: string; value?: string; description?: string },
  ) => {
    const now = new Date().toISOString();
    const cipher =
      updates.value !== undefined
        ? await encryptValue(updates.value, vaultKey)
        : undefined;
    collections.secrets.update(secretId, (draft) => {
      if (updates.name !== undefined) draft.name = updates.name;
      if (cipher !== undefined) draft.value = cipher;
      if (updates.description !== undefined) draft.description = updates.description;
      draft.updatedAt = now;
    });
  };

  const deleteSecret = (secretId: string) => {
    collections.secrets.delete([secretId]);
  };

  return { addSecret, updateSecret, deleteSecret };
}
