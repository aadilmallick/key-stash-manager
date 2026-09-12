import React, { useEffect } from "react";
import FolderSidebar from "../components/FolderSidebar";
import SecretsList from "../components/SecretsList";
import { useSync } from "@/hooks/useSync";
import { useDbContext } from "@/hooks/useDb";
import { AppStateProvider } from "@/hooks/useAppState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SpendTab from "@/components/spend/SpendTab";

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
      <div className="h-screen flex flex-col bg-gray-50">
        <Tabs defaultValue="secrets" className="flex flex-col flex-1 min-h-0">
          <div className="border-b bg-white px-4 pt-3">
            <TabsList>
              <TabsTrigger value="secrets">Secrets</TabsTrigger>
              <TabsTrigger value="spend">API Spend</TabsTrigger>
            </TabsList>
          </div>
          {
            /* forceMount + CSS visibility instead of Radix's default
              unmount-on-inactive: FolderSidebar/SecretsList aren't designed
              to be torn down and remounted (their live-query subscriptions
              and useAppState-derived UI state don't reliably re-sync on
              remount), so switching tabs away and back must hide/show
              rather than unmount/recreate them. */
          }
          <TabsContent
            value="secrets"
            forceMount
            className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden data-[state=active]:flex"
          >
            <FolderSidebar />
            <SecretsList />
          </TabsContent>
          <TabsContent
            value="spend"
            forceMount
            className="flex-1 min-h-0 mt-0 overflow-y-auto data-[state=inactive]:hidden data-[state=active]:block"
          >
            <SpendTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppStateProvider>
  );
};

export default Index;
