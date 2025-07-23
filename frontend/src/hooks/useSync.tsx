import {
  secretsDataSchema,
  STORAGE_KEY,
  useSecretsStore,
} from "@/store/secretsStore";
import { SecretsData } from "@/types";
import React, { useState } from "react";

const useSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { setData, loadData } = useSecretsStore();
  async function pushChangesToServer() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      console.error("No secrets found");
      return;
    }
    const response = await fetch("/api/sync", {
      method: "POST",
      body: localStorage.getItem(STORAGE_KEY),
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
    startSyncLoading();
    try {
      const response = await fetch("/api/sync", {
        method: "GET",
      });
      if (response.ok) {
        console.log("Pulled changes from server");
        const storage = await response.json();
        const parsed = secretsDataSchema.parse(storage);
        if (parsed) {
          setData(parsed as SecretsData);
        }
      } else {
        console.error("Failed to pull changes from server");
      }
    } catch (e) {
      loadData();
      console.error("Failed to pull changes from server", e);
    } finally {
      stopSyncLoading();
    }
  }

  const startSyncLoading = () => {
    setIsSyncing(true);
  };
  const stopSyncLoading = () => {
    setIsSyncing(false);
  };
  return {
    pushChangesToServer,
    isSyncing,
    startSyncLoading,
    stopSyncLoading,
    pullChangesFromServer,
  };
};

export default useSync;
