import { STORAGE_KEY, useSecretsStore } from "@/store/secretsStore";
import { fetchFromServer, isUsingServer } from "@/lib/SyncUtils";
import { SecretsData } from "@/types";
import React, { useState } from "react";

export const useSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { setData, loadData } = useSecretsStore();
  async function pushChangesToServer() {
    // opt out of sync if not using server
    if (!isUsingServer) {
      console.log("client side app only. Will not attempt to sync with server");
      return false;
    }

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
    // If not using server, always load from localStorage
    if (!isUsingServer) {
      loadData();
      return false;
    }
    startSyncLoading();
    try {
      const data = await fetchFromServer();
      if (data) {
        setData(data as SecretsData);
      } else {
        // Fallback to local storage if server returns nothing
        loadData();
      }
    } catch (e) {
      loadData();
      console.error("Failed to pull changes from server", e);
    } finally {
      stopSyncLoading();
    }
  }

  async function saveChangesToServer() {
    try {
      startSyncLoading();
      await pushChangesToServer();
      console.log("saved changes to server");
      stopSyncLoading();
    } catch (e) {
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
    saveChangesToServer,
  };
};
