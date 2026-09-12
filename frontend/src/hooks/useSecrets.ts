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

// On-demand decryption of a single secret's value by id, for UI that can't
// afford to eagerly decrypt every secret in scope (e.g. global search
// results, where only an explicitly-unmasked row's value should ever touch
// crypto.subtle). Returns null if the id no longer exists.
export function useSecretValueDecryptor(): {
  decryptSecretValue: (secretId: string) => Promise<string | null>;
} {
  const { collections, vaultKey } = useDbCollections();

  const decryptSecretValue = async (secretId: string): Promise<string | null> => {
    const row = collections.secrets.get(secretId) as SecretRow | undefined;
    if (!row) return null;
    return decryptValue(row.value, vaultKey);
  };

  return { decryptSecretValue };
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

  // Rewrites every secret's `order` within one folder to match its index in
  // the given list - used after a drag-and-drop reorder, where the caller
  // has already computed the full new ordering via computeReorderedIds().
  // Uses the batch form of update() (one transaction for every key) rather
  // than a loop of single-key updates - see reorderFolders() in
  // useFolders.ts for why that loop form isn't safe here.
  const reorderSecretsInFolder = (
    folderId: string,
    orderedSecretIds: string[],
  ) => {
    if (orderedSecretIds.length === 0) return;
    collections.secrets.update(orderedSecretIds, (drafts) => {
      drafts.forEach((draft, index) => {
        draft.order = index;
      });
    });
  };

  // Pure lookup, no mutation: does targetFolderId already contain a secret
  // with the same name as secretId? Names aren't encrypted (only `value`
  // is), so this reads plaintext directly off the collection - same
  // comparison importEnvFile() already uses for its own dedupe check.
  const findDuplicateInFolder = (
    secretId: string,
    targetFolderId: string,
  ): SecretRow | undefined => {
    const secret = collections.secrets.get(secretId) as SecretRow | undefined;
    if (!secret) return undefined;
    return (collections.secrets.toArray as unknown as SecretRow[]).find(
      (s) =>
        s.folderId === targetFolderId &&
        s.id !== secretId &&
        s.name === secret.name,
    );
  };

  // Moves a secret into targetFolderId, appended after that folder's
  // existing secrets. If overwriteId is given, that secret is deleted
  // first - the caller is responsible for having confirmed this with the
  // user (see FolderSidebar.tsx's drop handler); this function itself
  // never prompts.
  const moveSecretToFolder = (
    secretId: string,
    targetFolderId: string,
    overwriteId?: string,
  ) => {
    if (overwriteId) collections.secrets.delete([overwriteId]);
    const siblings = (
      collections.secrets.toArray as unknown as SecretRow[]
    ).filter((s) => s.folderId === targetFolderId && s.id !== secretId);
    const nextOrder =
      siblings.length > 0
        ? Math.max(...siblings.map((s) => s.order ?? 0)) + 1
        : 0;
    collections.secrets.update(secretId, (draft) => {
      draft.folderId = targetFolderId;
      draft.order = nextOrder;
      draft.updatedAt = new Date().toISOString();
    });
  };

  return {
    addSecret,
    updateSecret,
    deleteSecret,
    reorderSecretsInFolder,
    findDuplicateInFolder,
    moveSecretToFolder,
  };
}
