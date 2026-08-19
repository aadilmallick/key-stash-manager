import { fetchFromServer, isUsingServer } from "@/lib/SyncUtils";
import { buildNestedSecretsData, importAllFromJson } from "@/lib/db/importExport";
import { useDbContext } from "./useDb";

// Sync stays plaintext at the transport boundary: /api/sync exchanges the
// nested wire format (see buildNestedSecretsData/importAllFromJson) with
// decrypted values. Encryption-at-rest only applies to the local wa-sqlite
// file, not the sync payload - matches current/pre-migration behavior.
export const useSync = () => {
  const dbState = useDbContext();

  async function pushChangesToServer() {
    if (!isUsingServer) {
      console.log("client side app only. Will not attempt to sync with server");
      return false;
    }
    if (dbState.status !== "ready") return false;

    const data = await buildNestedSecretsData(dbState.collections, dbState.vaultKey);
    const response = await fetch("/api/sync", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (response.ok) {
      console.log("Synced with server");
    } else {
      console.error("Failed to sync with server");
    }
  }

  async function pullChangesFromServer() {
    if (!isUsingServer) return false;
    if (dbState.status !== "ready") return false;

    dbState.setIsSyncing(true);
    try {
      const data = await fetchFromServer();
      if (data) {
        await importAllFromJson(
          JSON.stringify(data),
          dbState.collections,
          dbState.vaultKey,
        );
      }
    } catch (e) {
      console.error("Failed to pull changes from server", e);
    } finally {
      dbState.setIsSyncing(false);
    }
  }

  async function saveChangesToServer() {
    if (dbState.status !== "ready") return;
    try {
      dbState.setIsSyncing(true);
      await pushChangesToServer();
      console.log("saved changes to server");
    } finally {
      dbState.setIsSyncing(false);
    }
  }

  const isSyncing = dbState.status === "ready" ? dbState.isSyncing : false;
  const startSyncLoading = () => {
    if (dbState.status === "ready") dbState.setIsSyncing(true);
  };
  const stopSyncLoading = () => {
    if (dbState.status === "ready") dbState.setIsSyncing(false);
  };

  return {
    pushChangesToServer,
    isSyncing,
    startSyncLoading,
    stopSyncLoading,
    pullChangesFromServer,
    saveChangesToServer,
  };
};
