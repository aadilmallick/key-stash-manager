import React, { useState } from "react";

const useSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  async function pushChangesToServer() {
    if (!localStorage.getItem("api-key-manager-secrets")) {
      console.error("No secrets found");
      return;
    }
    const response = await fetch("/api/sync", {
      method: "POST",
      body: localStorage.getItem("api-key-manager-secrets"),
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
  const startSyncLoading = () => {
    setIsSyncing(true);
  };
  const stopSyncLoading = () => {
    setIsSyncing(false);
  };
  return { pushChangesToServer, isSyncing, startSyncLoading, stopSyncLoading };
};

export default useSync;
