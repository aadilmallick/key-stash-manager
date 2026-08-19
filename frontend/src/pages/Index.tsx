import React, { useEffect } from "react";
import FolderSidebar from "../components/FolderSidebar";
import SecretsList from "../components/SecretsList";
import { useSync } from "@/hooks/useSync";
import { useDbContext } from "@/hooks/useDb";
import { AppStateProvider } from "@/hooks/useAppState";

const Index = () => {
  const dbState = useDbContext();
  const { pullChangesFromServer } = useSync();

  useEffect(() => {
    if (dbState.status === "ready") {
      pullChangesFromServer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbState.status]);

  if (dbState.status === "loading") {
    return <div>Loading vault...</div>;
  }

  if (dbState.status === "error") {
    return <div>Failed to load vault. Please reload the page.</div>;
  }

  return (
    <AppStateProvider>
      <div className="h-screen flex bg-gray-50">
        <FolderSidebar />
        <SecretsList />
      </div>
    </AppStateProvider>
  );
};

export default Index;
