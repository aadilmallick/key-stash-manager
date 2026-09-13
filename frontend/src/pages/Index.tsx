import React, { lazy, Suspense, useEffect, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import FolderSidebar from "../components/FolderSidebar";
import SecretsList from "../components/SecretsList";
import { useSync } from "@/hooks/useSync";
import { useDbContext } from "@/hooks/useDb";
import { AppStateProvider } from "@/hooks/useAppState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import AuthControls from "@/components/auth/AuthControls";
import { useGlobalHotkey } from "@/hooks/useGlobalHotkey";

const SpendTab = lazy(() => import("@/components/spend/SpendTab"));
const PayWall = lazy(() => import("@/components/spend/PayWall"));
const GlobalSearchModal = lazy(
  () => import("@/components/search/GlobalSearchModal"),
);

const Index = () => {
  const dbState = useDbContext();
  const { pullChangesFromServer } = useSync();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useGlobalHotkey("k", () => setIsSearchOpen(true));

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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:shadow-md focus:rounded-md text-sm font-medium"
      >
        Skip to main content
      </a>
      <div className="h-screen flex flex-col bg-gray-50">
        <Tabs defaultValue="secrets" className="flex flex-col flex-1 min-h-0">
          <div className="border-b bg-white px-4 pt-3 flex items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="secrets">Secrets</TabsTrigger>
              <TabsTrigger value="spend">API Spend</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSearchOpen(true)}
              >
                <Search className="h-4 w-4 mr-2" />
                Search
                <kbd className="ml-2 text-xs text-muted-foreground border rounded px-1">
                  &#8984;K
                </kbd>
              </Button>
              <AuthControls />
            </div>
          </div>
          {
            /* forceMount + CSS visibility instead of Radix's default
              unmount-on-inactive: FolderSidebar/SecretsList aren't designed
              to be torn down and remounted (their live-query subscriptions
              and useAppState-derived UI state don't reliably re-sync on
              remount), so switching tabs away and back must hide/show
              rather than unmount/recreate them. */
          }
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsContent
              value="secrets"
              forceMount
              className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden data-[state=active]:flex"
            >
              <DndProvider backend={HTML5Backend}>
                <FolderSidebar />
                <SecretsList />
              </DndProvider>
            </TabsContent>
            <TabsContent
              value="spend"
              forceMount
              className="flex-1 min-h-0 mt-0 overflow-y-auto data-[state=inactive]:hidden data-[state=active]:block"
            >
              <Suspense
                fallback={
                  <div className="p-8 text-center text-muted-foreground">
                    Loading spend dashboard...
                  </div>
                }
              >
                <PayWall>
                  <SpendTab />
                </PayWall>
              </Suspense>
            </TabsContent>
          </main>
        </Tabs>
        <Suspense fallback={null}>
          <GlobalSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
          />
        </Suspense>
      </div>
    </AppStateProvider>
  );
};

export default Index;
